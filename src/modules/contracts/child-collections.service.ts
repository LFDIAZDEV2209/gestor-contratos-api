import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, ObjectLiteral, Repository } from 'typeorm';
import { ContractEntity } from './entities/contract.entity';
import { SubcontractEntity } from './entities/subcontracts.entity';
import { ObligationEntity } from './entities/obligations.entity';
import { DeliverableEntity } from './entities/deliverables.entity';
import { ExecEntity } from './entities/execs.entity';
import { PaymentEntity } from './entities/payments.entity';
import { ActaEntity } from './entities/actas.entity';
import { ModificationEntity } from './entities/modifications.entity';
import { RiskEntity } from './entities/risks.entity';
import { BreachEntity } from './entities/breaches.entity';
import { PlanEntity } from './entities/plans.entity';
import { COLECCIONES_HIJAS, ColeccionDef } from './child-registry';
import { newId } from '../../common/ids';
import { hoyISO, diffDias } from '../../common/dates';
import { NoEncontrado, Prohibido, Validacion, WarningRequiresConfirmation, Conflicto } from '../../common/exceptions/api-exception';
import { ReqContext } from '../../common/req-context';
import { entradasPorCampos } from '../../common/audit-diff';
import { AuditService } from '../audit/audit.service';
import { SettingsService } from '../settings/settings.service';
import { RolesService } from '../roles/roles.service';
import { valorActualDe } from '../../engines/metrics.engine';
import { efectoModificacion } from '../../engines/modification.engine';
import { CACHE_SERVICE, CacheService, invalidateReadModels } from '../../cache/cache.service';

/**
 * CRUD genérico para las colecciones hijas del contrato con reglas específicas
 * por colección (files/03): ejecución advierte si el acumulado supera el valor
 * actualizado; subcontratos validan la suma; pagos calculan el neto y exigen
 * APROBAR para aprobar/pagar; modificaciones son inmutables y aplican su
 * efecto sobre el contrato en la misma transacción.
 */
@Injectable()
export class ChildCollectionsService {
  private readonly repos = new Map<string, Repository<ObjectLiteral>>();

  constructor(
    private readonly ds: DataSource,
    @InjectRepository(ContractEntity) private readonly contracts: Repository<ContractEntity>,
    @InjectRepository(SubcontractEntity) private readonly subsRepo: Repository<SubcontractEntity>,
    @InjectRepository(ObligationEntity) private readonly oblsRepo: Repository<ObligationEntity>,
    @InjectRepository(DeliverableEntity) private readonly delsRepo: Repository<DeliverableEntity>,
    @InjectRepository(ExecEntity) private readonly execsRepo: Repository<ExecEntity>,
    @InjectRepository(PaymentEntity) private readonly paysRepo: Repository<PaymentEntity>,
    @InjectRepository(ActaEntity) private readonly actasRepo: Repository<ActaEntity>,
    @InjectRepository(ModificationEntity) private readonly modsRepo: Repository<ModificationEntity>,
    @InjectRepository(RiskEntity) private readonly risksRepo: Repository<RiskEntity>,
    @InjectRepository(BreachEntity) private readonly breachesRepo: Repository<BreachEntity>,
    @InjectRepository(PlanEntity) private readonly plansRepo: Repository<PlanEntity>,
    private readonly audit: AuditService,
    private readonly settings: SettingsService,
    private readonly roles: RolesService,
    @Inject(CACHE_SERVICE) private readonly cache: CacheService,
  ) {
    const mapa: [string, Repository<ObjectLiteral>][] = [
      ['subcontracts', subsRepo as Repository<ObjectLiteral>],
      ['obligations', oblsRepo as Repository<ObjectLiteral>],
      ['deliverables', delsRepo as Repository<ObjectLiteral>],
      ['execs', execsRepo as Repository<ObjectLiteral>],
      ['payments', paysRepo as Repository<ObjectLiteral>],
      ['actas', actasRepo as Repository<ObjectLiteral>],
      ['modifications', modsRepo as Repository<ObjectLiteral>],
      ['risks', risksRepo as Repository<ObjectLiteral>],
      ['breaches', breachesRepo as Repository<ObjectLiteral>],
      ['plans', plansRepo as Repository<ObjectLiteral>],
    ];
    for (const [nombre, r] of mapa) this.repos.set(nombre, r);
  }

  def(coleccion: string): ColeccionDef {
    const def = COLECCIONES_HIJAS.find((c) => c.nombre === coleccion);
    if (!def) throw new NoEncontrado(`La colección ${coleccion}`);
    return def;
  }

  private repoDe(coleccion: string): Repository<ObjectLiteral> {
    const repo = this.repos.get(coleccion);
    if (!repo) throw new NoEncontrado(`La colección ${coleccion}`);
    return repo;
  }

  /** Lista global con filtros + paginación. */
  async listar(coleccion: string, query: Record<string, unknown>): Promise<{ data: ObjectLiteral[]; total: number; page: number; pageSize: number }> {
    this.def(coleccion);
    const repo = this.repoDe(coleccion);
    const qb = repo.createQueryBuilder('x');
    if (query.contractId) qb.andWhere('x.contractId = :contractId', { contractId: query.contractId });
    if (query.estado) qb.andWhere('x.estado = :estado', { estado: query.estado });
    if (query.obligationId) qb.andWhere('x.obligationId = :obligationId', { obligationId: query.obligationId });
    if (query.q) {
      qb.andWhere('(x.numero ILIKE :q OR x.contratista ILIKE :q OR x.descripcion ILIKE :q OR x.riesgo ILIKE :q OR x.hallazgo ILIKE :q)', { q: `%${query.q}%` });
    }
    const page = Math.max(1, Math.trunc(Number(query.page)) || 1);
    const pageSize = Math.min(500, Math.max(1, Math.trunc(Number(query.pageSize)) || 25));
    const [data, total] = await qb
      .orderBy('x.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();
    return { data, total, page, pageSize };
  }

  async listarPorContrato(coleccion: string, contractId: string): Promise<ObjectLiteral[]> {
    this.def(coleccion);
    return this.repoDe(coleccion).find({
      where: { contractId },
      order: { createdAt: 'DESC' },
    } as never);
  }

  async crear(coleccion: string, dto: Record<string, unknown>, ctx: ReqContext, force: boolean): Promise<ObjectLiteral> {
    const def = this.def(coleccion);
    const contrato = await this.contratoPadre(dto.contractId as string);
    const { errores, advertencias } = await this.validarReglas(coleccion, contrato, dto, ctx, null);
    if (errores.length) throw new Validacion(errores[0], []);
    if (advertencias.length && !force) {
      throw new WarningRequiresConfirmation('Advertencia: el registro tiene inconsistencias aceptables.', advertencias);
    }
    if (coleccion === 'modifications') {
      const result = await this.crearModificacion(contrato, dto, ctx, force);
      await invalidateReadModels(this.cache);
      return result;
    }
    const repo = this.repoDe(coleccion);
    const datos = { ...dto };
    this.prepararGuardado(coleccion, datos, null);
    const ent = await repo.save(repo.create({ ...datos, id: newId(def.prefijo), version: 1 }));
    await invalidateReadModels(this.cache);
    await this.audit.registrar(ctx, [{
      contractId: contrato.id, modulo: def.modulo, accion: 'CREAR',
      nuevo: `${(ent as unknown as { id: string }).id}`,
    }]);
    return ent;
  }

  async actualizar(coleccion: string, id: string, dto: Record<string, unknown>, ctx: ReqContext, force: boolean): Promise<ObjectLiteral> {
    const def = this.def(coleccion);
    if (!def.permiteEditar) {
      throw new Validacion('Las modificaciones son inmutables: anule el registro y registre uno nuevo.');
    }
    const repo = this.repoDe(coleccion);
    const ent = await repo.findOne({ where: { id } } as never);
    if (!ent) throw new NoEncontrado(`El registro ${id}`);
    if ((ent as unknown as { estado?: string }).estado === 'Anulado') {
      throw new Validacion('El registro está anulado y no se puede editar.');
    }
    const contrato = await this.contratoPadre((ent as unknown as { contractId: string }).contractId);
    const { errores, advertencias } = await this.validarReglas(coleccion, contrato, dto, ctx, ent);
    if (errores.length) throw new Validacion(errores[0], []);
    if (advertencias.length && !force) {
      throw new WarningRequiresConfirmation('Advertencia: los cambios tienen inconsistencias aceptables.', advertencias);
    }
    const version = Number(dto.version);
    if (!Number.isInteger(version)) throw new Validacion('La versión del registro es requerida.', ['version']);
    const prev = { ...ent };
    const datos = { ...dto };
    delete datos.id;
    delete datos.version;
    this.prepararGuardado(coleccion, datos, ent);
    Object.assign(ent, datos);
    const actual = (ent as unknown as { version: number }).version;
    if (version !== actual) {
      throw new Conflicto('La versión del registro está desactualizada. Recargue el registro y vuelva a intentarlo.', ['version']);
    }
    const res = await repo.update({ id }, { ...datos, version: version + 1 } as never);
    if (!res.affected) {
      throw new Conflicto('La versión del registro está desactualizada. Recargue el registro y vuelva a intentarlo.', ['version']);
    }
    await invalidateReadModels(this.cache);
    const cambios = Object.keys(datos).filter((k) => k !== 'contractId');
    await this.audit.registrar(
      ctx,
      entradasPorCampos(prev, ent as unknown as Record<string, unknown>, cambios, {
        contractId: contrato.id, modulo: def.modulo, accion: 'EDITAR',
      }),
    );
    return repo.findOne({ where: { id } } as never) as Promise<ObjectLiteral>;
  }

  /** Anulación con motivo (nunca DELETE). */
  async anular(coleccion: string, id: string, motivo: string, ctx: ReqContext): Promise<ObjectLiteral> {
    const def = this.def(coleccion);
    const repo = this.repoDe(coleccion);
    const ent = await repo.findOne({ where: { id } } as never);
    if (!ent) throw new NoEncontrado(`El registro ${id}`);
    const e = ent as unknown as Record<string, unknown>;
    // Fix: con campoEstado (9/10 colecciones) se anula por estado==='Anulado';
    // sin campoEstado (execs) se usa motivoAnulacion != null.
    const yaAnulado = def.campoEstado
      ? String(e[def.campoEstado]) === 'Anulado'
      : e.motivoAnulacion != null;
    if (yaAnulado) {
      throw new Validacion('El registro ya está anulado.');
    }
    if (def.campoEstado) e[def.campoEstado] = 'Anulado';
    e.motivoAnulacion = motivo;
    const versionActual = Number(e.version ?? 1);
    await repo.update({ id }, {
      ...(def.campoEstado ? { [def.campoEstado]: 'Anulado' } : {}),
      motivoAnulacion: motivo,
      version: versionActual + 1,
    } as never);
    await invalidateReadModels(this.cache);
    await this.audit.registrar(ctx, [{
      contractId: (e.contractId as string) ?? null,
      modulo: def.modulo, accion: 'ANULAR', obs: motivo,
    }]);
    return repo.findOne({ where: { id } } as never) as Promise<ObjectLiteral>;
  }

  /** Reglas específicas por colección. */
  private async validarReglas(
    coleccion: string,
    contrato: ContractEntity,
    dto: Record<string, unknown>,
    ctx: ReqContext,
    existente: ObjectLiteral | null,
  ): Promise<{ errores: string[]; advertencias: string[] }> {
    const errores: string[] = [];
    const advertencias: string[] = [];
    const hoy = hoyISO();
    const valorActual = valorActualDe(contrato.valorBase, contrato.iva, contrato.otrosImp, contrato.adiciones, contrato.reducciones);

    if (coleccion === 'execs') {
      const avance = dto.avanceFisico;
      if (avance != null && Number(avance) > 100) {
        errores.push('El avance físico del periodo no puede superar el 100 %.');
      }
      const exs = await this.execsRepo.find({ where: { contractId: contrato.id, motivoAnulacion: IsNull() } });
      const acumulado = exs
        .filter((e) => e.id !== (existente as unknown as { id?: string } | null)?.id)
        .reduce((s, e) => s + e.valor, 0) + Number(dto.valor ?? 0);
      if (acumulado > valorActual) {
        advertencias.push(`El acumulado de ejecución (${acumulado}) supera el valor actualizado del contrato (${valorActual}).`);
      }
    }
    if (coleccion === 'deliverables' && dto.avance != null && Number(dto.avance) > 100) {
      errores.push('El avance del entregable no puede superar el 100 %.');
    }
    if (coleccion === 'subcontracts') {
      const subs = await this.subsRepo.find({ where: { contractId: contrato.id } });
      const suma = subs
        .filter((s) => s.estado !== 'Anulado' && s.id !== (existente as unknown as { id?: string } | null)?.id)
        .reduce((t, s) => t + s.valor, 0) + Number(dto.valor ?? 0);
      if (suma > valorActual) {
        errores.push(`La suma de subcontratos (${suma}) supera el valor del contrato principal (${valorActual}).`);
      }
    }
    if (coleccion === 'payments' && existente) {
      const nuevoEstado = dto.estado;
      const actual = (existente as unknown as { estado: string }).estado;
      if (nuevoEstado && nuevoEstado !== actual && ['Aprobado', 'Pagado'].includes(nuevoEstado as string)) {
        if (!(await this.roles.tienePermiso(ctx.rol, 'APROBAR'))) {
          throw new Prohibido('Aprobar o pagar un pago requiere el permiso APROBAR.');
        }
      }
    }
    return { errores, advertencias };
  }

  /** Campos calculados antes de guardar (neto de pago, fechas de aprobación/pago). */
  private prepararGuardado(coleccion: string, datos: Record<string, unknown>, existente: ObjectLiteral | null): void {
    if (coleccion === 'payments') {
      datos.neto = Math.round(Number(datos.bruto ?? 0)) + Math.round(Number(datos.iva ?? 0)) - Math.round(Number(datos.retenciones ?? 0));
      if (datos.estado === 'Aprobado' && !datos.fechaAprob) datos.fechaAprob = hoyISO();
      if (datos.estado === 'Pagado') {
        if (!datos.fechaAprob) datos.fechaAprob = hoyISO();
        if (!datos.fechaPago) datos.fechaPago = hoyISO();
      }
      void existente;
    }
  }

  /** Crear modificación: aplica el efecto sobre el contrato en la misma transacción. */
  private async crearModificacion(contrato: ContractEntity, dto: Record<string, unknown>, ctx: ReqContext, force: boolean): Promise<ObjectLiteral> {
    const hoy = hoyISO();
    const advertencias: string[] = [];
    if (dto.tipo === 'Suspensión' && dto.fecha && contrato.fechaInicio && contrato.fechaFin) {
      if (diffDias(contrato.fechaInicio, dto.fecha as string) < 0 || diffDias(dto.fecha as string, contrato.fechaFin) < 0) {
        advertencias.push('La fecha de la suspensión está fuera del periodo de ejecución del contrato.');
      }
    }
    if (advertencias.length && !force) {
      throw new WarningRequiresConfirmation('Advertencia: la modificación tiene inconsistencias aceptables.', advertencias);
    }
    const efecto = efectoModificacion(
      {
        id: contrato.id, numero: contrato.numero, estado: contrato.estado, anulado: contrato.anulado,
        fechaFin: contrato.fechaFin ?? null, valorBase: contrato.valorBase, iva: contrato.iva,
        otrosImp: contrato.otrosImp, adiciones: contrato.adiciones, reducciones: contrato.reducciones,
        contratista: contrato.contratista, supervisor: contrato.supervisor,
      },
      { tipo: dto.tipo as string, valorNuevo: (dto.valorNuevo as number) ?? null, fechaNueva: (dto.fechaNueva as string) ?? null, nuevoTexto: (dto.nuevoTexto as string) ?? null },
    );

    return this.ds.transaction(async (em) => {
      const mods = em.getRepository(ModificationEntity);
      const mod = await mods.save(mods.create({ ...dto, id: newId('MD'), estado: 'Activa', version: 1 }));

      const cRepo = em.getRepository(ContractEntity);
      const fresh = await cRepo.findOneOrFail({ where: { id: contrato.id } });
      const prev = {
        adiciones: fresh.adiciones, reducciones: fresh.reducciones, fechaFin: fresh.fechaFin,
        estado: fresh.estado, contratista: fresh.contratista, supervisor: fresh.supervisor,
      };
      if (efecto.cambios.adiciones !== undefined) fresh.adiciones = efecto.cambios.adiciones;
      if (efecto.cambios.reducciones !== undefined) fresh.reducciones = efecto.cambios.reducciones;
      if (efecto.cambios.fechaFin !== undefined) fresh.fechaFin = efecto.cambios.fechaFin;
      if (efecto.cambios.estado !== undefined) fresh.estado = efecto.cambios.estado;
      if (efecto.cambios.contratista !== undefined) fresh.contratista = efecto.cambios.contratista;
      if (efecto.cambios.supervisor !== undefined) fresh.supervisor = efecto.cambios.supervisor;
      if (efecto.impactoAutomatico && !dto.impacto) dto.impacto = efecto.impactoAutomatico;
      await cRepo.save(fresh);

      const entradas = entradasPorCampos(prev as unknown as Record<string, unknown>, fresh as unknown as Record<string, unknown>, Object.keys(efecto.cambios), { contractId: contrato.id, modulo: 'Modificaciones', accion: 'EFECTO' });
      entradas.push({
        contractId: contrato.id, modulo: 'Modificaciones', accion: 'CREAR',
        nuevo: `${mod.numero} (${mod.tipo})${efecto.avisoRevisarPolizas ? ' — revise las pólizas' : ''}`,
      });
      await this.audit.registrarEn(em, ctx, entradas);
      return { modificacion: mod, efecto: efecto.cambios, aviso: efecto.avisoRevisarPolizas ? 'Revise las pólizas del contrato: pueden necesitar más valor o más vigencia.' : undefined };
    });
  }

  private async contratoPadre(contractId?: string): Promise<ContractEntity> {
    if (!contractId) throw new Validacion('El contrato es requerido.', ['contractId']);
    const c = await this.contracts.findOne({ where: { id: contractId } });
    if (!c) throw new NoEncontrado(`El contrato ${contractId}`);
    if (c.anulado) throw new Validacion('El contrato está anulado y no admite cambios en sus registros.');
    return c;
  }
}
