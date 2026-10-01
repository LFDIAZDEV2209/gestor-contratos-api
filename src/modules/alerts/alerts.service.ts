import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ContractEntity } from '../contracts/entities/contract.entity';
import { CupoEntity } from '../contracts/entities/quotas.entity';
import { GuaranteeEntity } from '../contracts/entities/guarantees.entity';
import { AlertStateEntity, AlertKeyEntity, TaskEntity } from './alerts.entity';
import { ContractContextLoader } from '../contracts/contract-context.loader';
import { SettingsService } from '../settings/settings.service';
import { AuditService } from '../audit/audit.service';
import { UsersService } from '../users/users.service';
import { newId } from '../../common/ids';
import { hoyISO } from '../../common/dates';
import { NoEncontrado, Prohibido, Validacion, Conflicto } from '../../common/exceptions/api-exception';
import { ReqContext } from '../../common/req-context';
import { calcularAlertas, calcularAlertasCupos, AlertaCalculada, NivelAlerta } from '../../engines/alerts.engine';
import { calcularMetricas } from '../../engines/metrics.engine';
import { cupoStats } from '../../engines/cupo.engine';
import { RolesService } from '../roles/roles.service';

export interface AlertaViva extends AlertaCalculada {
  gestion?: {
    estado: string;
    delegadoA?: string | null;
    nota?: string | null;
    usuario?: string;
    fechaGestion?: Date;
  } | null;
  /** true si el worker aún no la había visto (umbral recién cruzado). */
  nueva: boolean;
}

/** Alertas recalculadas en el servidor + gestión persistida + tareas. */
@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(
    @InjectRepository(ContractEntity) private readonly contracts: Repository<ContractEntity>,
    @InjectRepository(CupoEntity) private readonly cupos: Repository<CupoEntity>,
    @InjectRepository(GuaranteeEntity) private readonly gars: Repository<GuaranteeEntity>,
    @InjectRepository(AlertStateEntity) private readonly estados: Repository<AlertStateEntity>,
    @InjectRepository(AlertKeyEntity) private readonly claves: Repository<AlertKeyEntity>,
    @InjectRepository(TaskEntity) private readonly tareas: Repository<TaskEntity>,
    private readonly loader: ContractContextLoader,
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
    private readonly users: UsersService,
    private readonly roles: RolesService,
  ) {}

  /** Calcula todas las alertas vivas y les une su estado de gestión (files/03). */
  async listar(query: Record<string, unknown>): Promise<{ data: AlertaViva[]; total: number }> {
    const { alertas } = await this.computarTodas();
    const claves = alertas.map((a) => a.key);
    const [gestiones, vistas] = await Promise.all([
      claves.length ? this.estados.find({ where: { alertKey: In(claves) } }) : Promise.resolve([]),
      claves.length ? this.claves.find({ where: { alertKey: In(claves) } }) : Promise.resolve([]),
    ]);
    const gestionMap = new Map(gestiones.map((g) => [g.alertKey, g]));
    const vistasSet = new Set(vistas.map((v) => v.alertKey));

    let data: AlertaViva[] = alertas.map((a) => ({
      ...a,
      gestion: gestionMap.get(a.key) ?? null,
      nueva: !vistasSet.has(a.key),
    }));

    if (query.nivel) data = data.filter((a) => a.nivel === query.nivel);
    if (query.contractId) data = data.filter((a) => a.contractId === query.contractId);
    if (query.estado) {
      const buscado = query.estado as string;
      data = data.filter((a) =>
        buscado === 'Nueva' ? !gestionMap.has(a.key) : gestionMap.get(a.key)?.estado === buscado,
      );
    }
    data.sort((a, b) => ordenNivel(a.nivel) - ordenNivel(b.nivel) || a.key.localeCompare(b.key));
    return { data, total: data.length };
  }

  async marcarLeida(key: string, ctx: ReqContext): Promise<AlertStateEntity> {
    return this.gestionar(key, 'Leída', null, null, ctx);
  }

  async resolver(key: string, nota: string, ctx: ReqContext): Promise<AlertStateEntity> {
    if (!(await this.roles.tienePermiso(ctx.rol, 'EDITAR'))) {
      throw new Prohibido('Resolver una alerta requiere el permiso EDITAR.');
    }
    return this.gestionar(key, 'Resuelta', null, nota, ctx);
  }

  async delegar(key: string, usuarioId: string, ctx: ReqContext): Promise<AlertStateEntity> {
    if (!(await this.roles.tienePermiso(ctx.rol, 'EDITAR'))) {
      throw new Prohibido('Delegar una alerta requiere el permiso EDITAR.');
    }
    const delegado = await this.users.obtener(usuarioId);
    return this.gestionar(key, 'Delegada', delegado.nombre, null, ctx);
  }

  private async gestionar(key: string, estado: string, delegadoA: string | null, nota: string | null, ctx: ReqContext): Promise<AlertStateEntity> {
    const existente = await this.estados.findOne({ where: { alertKey: key } });
    const fila = existente ?? this.estados.create({ alertKey: key, estado, delegadoA, nota, usuario: ctx.usuario, fechaGestion: new Date() });
    fila.estado = estado;
    if (delegadoA !== null) fila.delegadoA = delegadoA;
    if (nota !== null) fila.nota = nota;
    fila.usuario = ctx.usuario;
    fila.fechaGestion = new Date();
    await this.estados.save(fila);
    await this.audit.registrar(ctx, [{ modulo: 'Alertas', accion: estado.toUpperCase(), campo: key, obs: nota ?? delegadoA ?? null }]);
    return fila;
  }

  async crearTareaDesdeAlerta(key: string, dto: { titulo: string; asignado: string; vence?: string }, ctx: ReqContext): Promise<TaskEntity> {
    const { alertas } = await this.computarTodas();
    const alerta = alertas.find((a) => a.key === key);
    if (!alerta) throw new NoEncontrado(`La alerta ${key}`);
    const asignado = await this.users.obtener(dto.asignado);
    const t = await this.tareas.save(this.tareas.create({
      id: newId('TA'),
      titulo: dto.titulo,
      asignado: asignado.id,
      vence: dto.vence ?? null,
      contractId: alerta.contractId ?? null,
      alertKey: key,
      estado: 'Abierta',
      creadaPor: ctx.usuarioId,
    }));
    await this.audit.registrar(ctx, [{
      contractId: t.contractId, modulo: 'Alertas', accion: 'TAREA', nuevo: `${t.titulo} → ${asignado.nombre}`,
    }]);
    return t;
  }

  async listarTareas(): Promise<TaskEntity[]> {
    return this.tareas.find({ order: { estado: 'ASC', vence: 'ASC' } });
  }

  async actualizarTarea(id: string, dto: { estado?: string }, version: number, ctx: ReqContext): Promise<TaskEntity> {
    const t = await this.tareas.findOne({ where: { id } });
    if (!t) throw new NoEncontrado(`La tarea ${id}`);
    if (version !== t.version) {
      throw new Conflicto('La versión del registro está desactualizada. Recargue el registro y vuelva a intentarlo.', ['version']);
    }
    const res = await this.tareas.update({ id: t.id, version }, { ...(dto.estado ? { estado: dto.estado } : {}), version: version + 1 });
    if (!res.affected) {
      throw new Conflicto('La versión del registro está desactualizada. Recargue el registro y vuelva a intentarlo.', ['version']);
    }
    await this.audit.registrar(ctx, [{
      contractId: t.contractId, modulo: 'Alertas', accion: 'TAREA', campo: 'estado',
      nuevo: t.estado,
    }]);
    return this.tareas.findOneOrFail({ where: { id } });
  }

  /** Worker: recalcula y marca las claves nuevas (notificación solo al cruzar umbral, fase 3). */
  async recalcular(): Promise<{ total: number; nuevas: number }> {
    const { alertas } = await this.computarTodas();
    const existentes = new Set((await this.claves.find()).map((k) => k.alertKey));
    const nuevas = alertas.filter((a) => !existentes.has(a.key));
    if (nuevas.length) {
      await this.claves.upsert(
        nuevas.map((a) => ({ alertKey: a.key, tipo: a.tipo, contractId: a.contractId ?? null, primeraVez: new Date() })),
        ['alertKey'],
      );
      this.logger.log(`Recalculadas ${alertas.length} alertas; ${nuevas.length} nuevas por cruce de umbral (notificación por correo en fase 3).`);
    } else {
      this.logger.log(`Recalculadas ${alertas.length} alertas; sin cruces nuevos.`);
    }
    return { total: alertas.length, nuevas: nuevas.length };
  }

  private async computarTodas(): Promise<{ alertas: AlertaCalculada[] }> {
    const [contratos, cupos, params, hoy] = await Promise.all([
      this.contracts.find({ where: { anulado: false } }),
      this.cupos.find({ where: { estado: In(['Vigente', 'Suspendido', 'Vencido']) } }),
      this.settings.parametros(),
      Promise.resolve(hoyISO()),
    ]);
    const ctxs = await this.loader.cargar(contratos.map((c) => c.id));
    const alertas: AlertaCalculada[] = [];
    for (const c of contratos) {
      const ctx = ctxs.get(c.id);
      if (!ctx) continue;
      alertas.push(...calcularAlertas(ctx, calcularMetricas(ctx.contract, ctx, hoy), params, hoy));
    }
    // Cupos: uso por pólizas Aprobadas/Pendientes de contratos no anulados.
    const todasGars = await this.gars.find({ select: ['cupoId', 'estado', 'valor', 'contractId'] });
    const contratosAnulados = new Set((await this.contracts.find({ select: ['id'], where: { anulado: true } })).map((c) => c.id));
    const cuposConStats = cupos.map((cp) => ({
      id: cp.id, aseguradora: cp.aseguradora, numero: cp.numero, valor: cp.valor, estado: cp.estado, fechaVenc: cp.fechaVenc,
      stats: cupoStats(
        { id: cp.id, valor: cp.valor },
        todasGars.map((g) => ({ cupoId: g.cupoId, estado: g.estado, valor: g.valor, contractAnulado: contratosAnulados.has(g.contractId) })),
      ),
    }));
    alertas.push(...calcularAlertasCupos(cuposConStats, params, hoy));
    return { alertas };
  }
}

function ordenNivel(n: NivelAlerta): number {
  switch (n) {
    case 'critica': return 0;
    case 'riesgo': return 1;
    case 'proxima': return 2;
    default: return 3;
  }
}
