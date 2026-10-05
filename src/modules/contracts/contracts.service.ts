import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContractEntity } from './entities/contract.entity';
import { PaymentEntity } from './entities/payments.entity';
import { ActaEntity } from './entities/actas.entity';
import { DocumentEntity } from './entities/documents.entity';
import { ContractContextLoader } from './contract-context.loader';
import { SettingsService } from '../settings/settings.service';
import { AuditService } from '../audit/audit.service';
import { Conflicto, NoEncontrado, Validacion, WarningRequiresConfirmation } from '../../common/exceptions/api-exception';import { ReqContext } from '../../common/req-context';
import { entradasPorCampos } from '../../common/audit-diff';
import { hoyISO, periodoAFecha } from '../../common/dates';
import { paginar, Pagina, leerPagina } from '../../common/pagination';
import { Metricas, calcularMetricas, calcularControlScore } from '../../engines/metrics.engine';
import { calcularSemaforo, NivelSemaforo } from '../../engines/traffic-light.engine';
import { conciliar, duracionDe } from '../../engines/reconcile.engine';
import { validarBorrador, validarContratoCompleto, ValidadorResultado } from '../../engines/validator.engine';
import { ContractBase, ContractCtx, ParametrosAlerta } from '../../engines/types';
import { DEPARTAMENTOS } from '../../engines/map.engine';
import { CrearContratoDto, FiltrosContratos } from './contracts.dto';
import { ConfigService } from '@nestjs/config';
import { CACHE_SERVICE, CacheService, invalidateReadModels } from '../../cache/cache.service';

export type FilaContrato = ContractEntity & {
  metricas: Metricas & {
    nivel: NivelSemaforo;
    razones: string[];
    control: { score: number; nivel: 'verde' | 'amarillo' | 'rojo' };
  };
  aseguradoras: string[];
};

@Injectable()
export class ContractsService {
  constructor(
    @InjectRepository(ContractEntity) private readonly repo: Repository<ContractEntity>,
    @InjectRepository(PaymentEntity) private readonly pagosRepo: Repository<PaymentEntity>,
    @InjectRepository(ActaEntity) private readonly actasRepo: Repository<ActaEntity>,
    @InjectRepository(DocumentEntity) private readonly docsRepo: Repository<DocumentEntity>,
    private readonly loader: ContractContextLoader,
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
    @Inject(CACHE_SERVICE) private readonly cache: CacheService,
  ) {}

  private async parametros(): Promise<ParametrosAlerta> {
    return this.settings.parametros();
  }

  /** Lista con métricas M(c) y semáforo calculados en el servidor (files/03). */
  async listar(q: FiltrosContratos): Promise<Pagina<FilaContrato>> {
    const { page, pageSize } = leerPagina(q, this.config.get<number>('pageSize') ?? 25);
    const qb = this.repo.createQueryBuilder('c');
    if (!q.incluirAnulados) qb.andWhere('c.anulado = false');
    if (q.companyId) qb.andWhere('c.companyId = :companyId', { companyId: q.companyId });
    if (q.estado) qb.andWhere('c.estado = :estado', { estado: q.estado });
    if (q.tipo) qb.andWhere('c.tipo = :tipo', { tipo: q.tipo });
    if (q.responsable) qb.andWhere('c.responsable = :responsable', { responsable: q.responsable });
    if (q.supervisor) qb.andWhere('c.supervisor = :supervisor', { supervisor: q.supervisor });
    if (q.anio) qb.andWhere('EXTRACT(YEAR FROM c.fechaFirma) = :anio', { anio: q.anio });
    if (q.q) {
      qb.andWhere('(c.numero ILIKE :q OR c.contratista ILIKE :q OR c.objeto ILIKE :q)', { q: `%${q.q}%` });
    }
    let filas = await qb.getMany();

    // Filtros sobre cobertura (deptos jsonb) y región — en memoria a escala demo.
    if (q.depto) filas = filas.filter((c) => (c.deptos ?? []).includes(q.depto as string));
    if (q.region) {
      const codigos = Object.entries(DEPARTAMENTOS)
        .filter(([, v]) => v.region === q.region)
        .map(([k]) => k);
      filas = filas.filter((c) => (c.deptos ?? []).some((d) => codigos.includes(d)));
    }

    const ctxs = await this.loader.cargar(filas.map((c) => c.id));
    const params = await this.parametros();
    const hoy = hoyISO();

    let conMetricas = filas.map((c) => this.conMetricas(c, ctxs.get(c.id) as ContractCtx, hoy, params));

    // Aseguradora: contratos con pólizas de esa aseguradora.
    if (q.aseguradora) {
      const ids = new Set(await this.loader.idsConAseguradora(q.aseguradora));
      conMetricas = conMetricas.filter((f) => ids.has(f.id));
    }
    // Filtros que dependen de métricas calculadas.
    if (q.nivel) conMetricas = conMetricas.filter((f) => f.metricas.nivel === q.nivel);
    if (q.vencidos) conMetricas = conMetricas.filter((f) => f.metricas.estadoEfectivo === 'Vencido');
    if (q.proximos != null) {
      conMetricas = conMetricas.filter(
        (f) => f.metricas.restantes >= 0 && f.metricas.restantes <= Number(q.proximos),
      );
    }
    if (q.garantiasVencidas) {
      conMetricas = conMetricas.filter((f) =>
        (ctxs.get(f.id) as ContractCtx).guarantees.some(
          (g) => g.estado === 'Aprobada' && !!g.fechaVenc && g.fechaVenc < hoy,
        ),
      );
    }
    if (q.multiAseguradoras) conMetricas = conMetricas.filter((f) => f.aseguradoras.length >= 2);

    conMetricas.sort((a, b) => (b.fechaFirma ?? '').localeCompare(a.fechaFirma ?? ''));
    const total = conMetricas.length;
    return paginar(conMetricas.slice((page - 1) * pageSize, page * pageSize), total, page, pageSize);
  }

  async obtener(id: string): Promise<FilaContrato> {
    const c = await this.obtenerFila(id);
    const ctx = await this.loader.cargarUno(c);
    return this.conMetricas(c, ctx, hoyISO(), await this.parametros());
  }

  /** Todas las filas de contratos con métricas (lo usan dashboard y reportes). */
  async todasLasFilas(incluirAnulados = false): Promise<FilaContrato[]> {
    const contratos = await this.repo.find(incluirAnulados ? {} : { where: { anulado: false } });
    const ctxs = await this.loader.cargar(contratos.map((c) => c.id));
    const params = await this.parametros();
    const hoy = hoyISO();
    return contratos.map((c) => this.conMetricas(c, ctxs.get(c.id) as ContractCtx, hoy, params));
  }

  /** Contrato + métricas + semáforo + razones + índice de control (cabecera del expediente). */
  conMetricas(
    c: ContractEntity,
    ctx: ContractCtx,
    hoy: string,
    params: ParametrosAlerta,
  ): FilaContrato {
    const m = calcularMetricas(ctx.contract, ctx, hoy);
    const sem = calcularSemaforo(ctx.contract, ctx, m, hoy, params);
    const control = calcularControlScore(ctx.contract, ctx, m, hoy);
    const aseguradoras = [...new Set(ctx.guarantees.filter((g) => !g.anulado).map((g) => g.aseguradora))];
    return Object.assign(c, {
      metricas: { ...m, nivel: sem.nivel, razones: sem.razones, control },
      aseguradoras,
    });
  }

  async crear(dto: CrearContratoDto, ctx: ReqContext, force: boolean): Promise<FilaContrato> {
    // Validator.draft en el servidor: severidad Alta bloquea (400); Media/Baja ⇒ 422 con force.
    const issues = validarBorrador(dto as Partial<ContractBase>);
    const altas = issues.filter((i) => i.severidad === 'Alta');
    if (altas.length) {
      throw new Validacion(altas[0].mensaje, issues.map((i) => i.campo));
    }
    const advertencias = issues.map((i) => i.mensaje);
    if (advertencias.length && !force) {
      throw new WarningRequiresConfirmation('Advertencia: el registro tiene inconsistencias aceptables.', advertencias);
    }
    const numero = dto.numero.trim();
    if (await this.repo.findOne({ where: { numero } })) {
      throw new Conflicto(`El número de contrato ${numero} ya está registrado.`, ['numero']);
    }
    const c = await this.repo.save(
      this.repo.create({ ...dto, numero, estado: dto.estado ?? 'Borrador', version: 1 }),
    );
    await invalidateReadModels(this.cache);
    await this.audit.registrar(ctx, [{
      contractId: c.id, modulo: 'Contratos', accion: 'CREAR', nuevo: `${c.numero} (${c.contratista})`,
    }]);
    return this.obtener(c.id);
  }

  async actualizar(
    id: string,
    dto: CrearContratoDto & { version: number },
    ctx: ReqContext,
    force: boolean,
  ): Promise<FilaContrato> {
    const c = await this.obtenerFila(id);
    if (c.anulado) throw new Validacion('El contrato está anulado y no se puede editar.');
    const prev = { ...c };
    const fusionado = { ...c, ...dto };
    const issues = validarBorrador(fusionado as Partial<ContractBase>);
    const altas = issues.filter((i) => i.severidad === 'Alta');
    if (altas.length) {
      throw new Validacion(altas[0].mensaje, issues.map((i) => i.campo));
    }
    const advertencias = issues.map((i) => i.mensaje);
    if (advertencias.length && !force) {
      throw new WarningRequiresConfirmation('Advertencia: los cambios tienen inconsistencias aceptables.', advertencias);
    }
    if (dto.numero && dto.numero.trim() !== c.numero) {
      const otro = await this.repo.findOne({ where: { numero: dto.numero.trim() } });
      if (otro) throw new Conflicto(`El número de contrato ${dto.numero.trim()} ya está registrado.`, ['numero']);
    }
    const { version, ...cambios } = dto;
    if (version !== c.version) {
      throw new Conflicto('La versión del registro está desactualizada. Recargue el registro y vuelva a intentarlo.', ['version']);
    }
    Object.assign(c, cambios);
    const res = await this.repo.update({ id: c.id, version }, { ...cambios, version: version + 1 });
    if (!res.affected) {
      throw new Conflicto('La versión del registro está desactualizada. Recargue el registro y vuelva a intentarlo.', ['version']);
    }
    await invalidateReadModels(this.cache);
    await this.audit.registrar(
      ctx,
      entradasPorCampos(prev as unknown as Record<string, unknown>, c as unknown as Record<string, unknown>, Object.keys(cambios), { contractId: c.id, modulo: 'Contratos', accion: 'EDITAR' }),
    );
    return this.obtener(c.id);
  }

  /** Anulación (nunca borrado físico): anulado=true + estado Anulado + motivo. */
  async anular(id: string, motivo: string, ctx: ReqContext): Promise<FilaContrato> {
    const c = await this.obtenerFila(id);
    if (c.anulado) throw new Validacion('El contrato ya está anulado.');
    c.anulado = true;
    c.estado = 'Anulado';
    c.motivoAnulacion = motivo;
    await this.repo.save(c);
    await invalidateReadModels(this.cache);
    await this.audit.registrar(ctx, [{ contractId: c.id, modulo: 'Contratos', accion: 'ANULAR', obs: motivo }]);
    return this.obtener(id);
  }

  /** Validador integral (botón VALIDAR CONTRATO): 13 áreas. */
  async validar(id: string, ctx: ReqContext): Promise<ValidadorResultado & { semaforo: NivelSemaforo }> {
    const c = await this.obtenerFila(id);
    const ctxC = await this.loader.cargarUno(c);
    const params = await this.parametros();
    const hoy = hoyISO();
    const m = calcularMetricas(ctxC.contract, ctxC, hoy);
    const resultado = validarContratoCompleto(ctxC, m, hoy, params);
    await this.audit.registrar(ctx, [{
      contractId: c.id, modulo: 'Contratos', accion: 'VALIDAR', obs: resultado.resumen.mensaje,
    }]);
    return { ...resultado, semaforo: calcularSemaforo(ctxC.contract, ctxC, m, hoy, params).nivel };
  }

  /** Conciliación sistema vs. documento de categoría «Contrato» con datos extraídos. */
  async conciliar(id: string, ctx: ReqContext) {
    const c = await this.obtenerFila(id);
    const ctxC = await this.loader.cargarUno(c);
    const hoy = hoyISO();
    const m = calcularMetricas(ctxC.contract, ctxC, hoy);
    const doc = await this.docsRepo.findOne({
      where: { contractId: id, categoria: 'Contrato', estado: 'Activo' },
      order: { createdAt: 'DESC' },
    });
    const resultado = conciliar(
      {
        valorInicial: m.valorInicial,
        fechaInicio: c.fechaInicio,
        fechaFin: c.fechaFin,
        duracionDias: duracionDe(c.fechaInicio, c.fechaFin),
        objeto: c.objeto,
        contratista: c.contratista,
        nitContratista: c.nitContratista,
        tiposGarantia: [...new Set(ctxC.guarantees.filter((g) => !g.anulado).map((g) => g.tipo))],
      },
      doc?.extracted ?? null,
    );
    await this.audit.registrar(ctx, [{
      contractId: c.id, modulo: 'Contratos', accion: 'CONCILIAR',
      obs: resultado.disponible ? `${resultado.diferencias} diferencia(s) detectadas` : 'Sin documento para conciliar',
    }]);
    return { documento: doc ? { id: doc.id, nombre: doc.nombre, version: doc.version } : null, ...resultado };
  }

  /** Historial de eventos (modificaciones, actas, pagos, garantías, obligaciones, ejecución). */
  async timeline(id: string): Promise<{ contractId: string; data: EventoTimeline[] }> {
    const c = await this.obtenerFila(id);
    const ctx = await this.loader.cargarUno(c);
    const pagos = await this.pagosRepo.find({ where: { contractId: id } });
    const eventos: EventoTimeline[] = [];

    for (const mod of ctx.modifications.filter((x) => !x.anulado && x.fecha)) {
      eventos.push({
        fecha: mod.fecha as string,
        tipo: 'Modificación',
        titulo: `${mod.tipo} (${mod.id})`,
        detalle: mod.valorNuevo != null ? `Valor nuevo ${mod.valorNuevo}` : '',
        refId: mod.id,
      });
    }
    const actas = await this.actasRepo.find({ where: { contractId: id } });
    for (const a of actas) {
      if (a.estado === 'Anulada' || !a.fecha) continue;
      eventos.push({ fecha: a.fecha, tipo: 'Acta', titulo: `${a.tipo} (${a.id})`, detalle: a.estado, refId: a.id });
    }
    for (const p of pagos) {
      if (p.estado === 'Anulado' || !p.fecha) continue;
      eventos.push({ fecha: p.fecha, tipo: 'Pago', titulo: `Pago ${p.numero} — ${p.estado}`, detalle: p.factura, refId: p.id });
    }
    for (const g of ctx.guarantees.filter((x) => !x.anulado && x.fechaVenc)) {
      eventos.push({
        fecha: g.fechaVenc as string, tipo: 'Garantía', titulo: `${g.tipo} — ${g.poliza}`,
        detalle: `Vence ${g.fechaVenc} (${g.estado})`, refId: g.id,
      });
    }
    for (const o of ctx.obligations.filter((x) => !x.anulado && x.fechaLimite)) {
      eventos.push({ fecha: o.fechaLimite as string, tipo: 'Obligación', titulo: o.id, detalle: `Estado ${o.estado ?? ''}`, refId: o.id });
    }
    for (const e of ctx.execs.filter((x) => !x.anulado)) {
      eventos.push({ fecha: periodoAFecha(e.periodo), tipo: 'Ejecución', titulo: `Ejecución ${e.periodo}`, detalle: `Valor ${e.valor}`, refId: c.id });
    }
    eventos.sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
    return { contractId: c.id, data: eventos };
  }

  private async obtenerFila(id: string): Promise<ContractEntity> {
    const c = await this.repo.findOne({ where: { id } });
    if (!c) throw new NoEncontrado(`El contrato ${id}`);
    return c;
  }

  /** Registro de la solicitud de notificación (los canales se conectan en fase 3). */
  async registrarNotificacion(responsable: string | undefined, contractId: string, ctx: ReqContext): Promise<void> {
    await this.audit.registrar(ctx, [{
      contractId,
      modulo: 'Contratos',
      accion: 'NOTIFICAR',
      obs: `Notificación solicitada para ${responsable ?? 'responsable sin asignar'} (canales en fase 3)`,
    }]);
  }
}

export interface EventoTimeline {
  fecha: string;
  tipo: string;
  titulo: string;
  detalle: string;
  refId: string;
}
