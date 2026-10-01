import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ContractEntity } from './entities/contract.entity';
import { SubcontractEntity } from './entities/subcontracts.entity';
import { ObligationEntity } from './entities/obligations.entity';
import { DeliverableEntity } from './entities/deliverables.entity';
import { ExecEntity } from './entities/execs.entity';
import { PaymentEntity } from './entities/payments.entity';
import { GuaranteeEntity } from './entities/guarantees.entity';
import { ActaEntity } from './entities/actas.entity';
import { ModificationEntity } from './entities/modifications.entity';
import { RiskEntity } from './entities/risks.entity';
import { BreachEntity } from './entities/breaches.entity';
import { PlanEntity } from './entities/plans.entity';
import { DocumentEntity } from './entities/documents.entity';
import { AuditLogEntity } from '../audit/audit.entity';
import {
  Metricas, calcularMetricas, calcularControlScore,
} from '../../engines/metrics.engine';
import { ContractBase, ContractCtx, ParametrosAlerta } from '../../engines/types';
import { calcularSemaforo, NivelSemaforo } from '../../engines/traffic-light.engine';

export interface ContratoCompleto {
  metricas: Metricas & {
    nivel: NivelSemaforo;
    razones: string[];
    control: { score: number; nivel: 'verde' | 'amarillo' | 'rojo' };
  };
  aseguradoras: string[];
}

/**
 * Carga los agregados de los hijos de cada contrato (execs, pagos, obligaciones,
 * garantías, riesgos, entregables, documentos, subcontratos, modificaciones,
 * planes, actas y auditoría) para alimentar M(c), el semáforo, el validador y
 * las alertas calculadas EN SERVIDOR. Un lote de consultas por lote de contratos.
 */
@Injectable()
export class ContractContextLoader {
  constructor(
    @InjectRepository(ContractEntity) private readonly contracts: Repository<ContractEntity>,
    @InjectRepository(SubcontractEntity) private readonly subs: Repository<SubcontractEntity>,
    @InjectRepository(ObligationEntity) private readonly obligs: Repository<ObligationEntity>,
    @InjectRepository(DeliverableEntity) private readonly dels: Repository<DeliverableEntity>,
    @InjectRepository(ExecEntity) private readonly execs: Repository<ExecEntity>,
    @InjectRepository(PaymentEntity) private readonly pays: Repository<PaymentEntity>,
    @InjectRepository(GuaranteeEntity) private readonly gars: Repository<GuaranteeEntity>,
    @InjectRepository(ActaEntity) private readonly actas: Repository<ActaEntity>,
    @InjectRepository(ModificationEntity) private readonly mods: Repository<ModificationEntity>,
    @InjectRepository(RiskEntity) private readonly risks: Repository<RiskEntity>,
    @InjectRepository(BreachEntity) private readonly breaches: Repository<BreachEntity>,
    @InjectRepository(PlanEntity) private readonly plans: Repository<PlanEntity>,
    @InjectRepository(DocumentEntity) private readonly docs: Repository<DocumentEntity>,
    @InjectRepository(AuditLogEntity) private readonly auditRepo: Repository<AuditLogEntity>,
  ) {}

  async cargar(ids: string[]): Promise<Map<string, ContractCtx>> {
    const map = new Map<string, ContractCtx>();
    if (!ids.length) return map;

    const [
      contratos, exs, pgs, obs, gars, brs, rgs, dns, dcs, scs, mds, pms, acs,
    ] = await Promise.all([
      this.contracts.find({ where: { id: In(ids) } }),
      this.execs.find({ where: { contractId: In(ids) } }),
      this.pays.find({ where: { contractId: In(ids) } }),
      this.obligs.find({ where: { contractId: In(ids) } }),
      this.gars.find({ where: { contractId: In(ids) } }),
      this.breaches.find({ where: { contractId: In(ids) } }),
      this.risks.find({ where: { contractId: In(ids) } }),
      this.dels.find({ where: { contractId: In(ids) } }),
      this.docs.find({ where: { contractId: In(ids) } }),
      this.subs.find({ where: { contractId: In(ids) } }),
      this.mods.find({ where: { contractId: In(ids) } }),
      this.plans.find({ where: { contractId: In(ids) } }),
      this.actas.find({ where: { contractId: In(ids) } }),
    ]);

    const conteos = new Map<string, number>();
    if (ids.length) {
      const filas: { contract_id: string; c: number }[] = await this.auditRepo.query(
        'SELECT contract_id, COUNT(*)::int AS c FROM audit_log WHERE contract_id = ANY($1) GROUP BY contract_id',
        [ids],
      );
      for (const f of filas) conteos.set(f.contract_id, Number(f.c));
    }

    for (const c of contratos) {
      map.set(c.id, this.aCtx(c, exs, pgs, obs, gars, brs, rgs, dns, dcs, scs, mds, pms, acs, conteos));
    }
    return map;
  }

  async cargarUno(c: ContractEntity): Promise<ContractCtx> {
    const map = await this.cargar([c.id]);
    return map.get(c.id) as ContractCtx;
  }

  /** Métricas + semáforo + control + aseguradoras de un contrato. */
  async calcularTodo(
    c: ContractEntity,
    ctx: ContractCtx,
    hoy: string,
    params: ParametrosAlerta,
  ): Promise<ContratoCompleto> {
    const m = calcularMetricas(ctx.contract, ctx, hoy);
    const sem = calcularSemaforo(ctx.contract, ctx, m, hoy, params);
    const control = calcularControlScore(ctx.contract, ctx, m, hoy);
    const aseguradoras = [...new Set(ctx.guarantees.filter((g) => !g.anulado).map((g) => g.aseguradora))];
    return { metricas: { ...m, nivel: sem.nivel, razones: sem.razones, control }, aseguradoras };
  }

  async idsConAseguradora(aseguradora: string): Promise<string[]> {
    const gars = await this.gars.find({ select: ['contractId'], where: { aseguradora } });
    return [...new Set(gars.map((g) => g.contractId))];
  }

  private aCtx(
    c: ContractEntity,
    exs: ExecEntity[],
    pgs: PaymentEntity[],
    obs: ObligationEntity[],
    gars: GuaranteeEntity[],
    brs: BreachEntity[],
    rgs: RiskEntity[],
    dns: DeliverableEntity[],
    dcs: DocumentEntity[],
    scs: SubcontractEntity[],
    mds: ModificationEntity[],
    pms: PlanEntity[],
    acs: ActaEntity[],
    conteos: Map<string, number>,
  ): ContractCtx {
    return {
      contract: this.base(c),
      execs: exs.filter((e) => e.contractId === c.id)
        .map((e) => ({ periodo: e.periodo, valor: e.valor, anulado: !!e.motivoAnulacion })),
      payments: pgs.filter((p) => p.contractId === c.id)
        .map((p) => ({
          id: p.id, estado: p.estado, bruto: p.bruto, iva: p.iva, retenciones: p.retenciones,
          neto: p.neto, soporte: p.soporte, anulado: p.estado === 'Anulado',
        })),
      guarantees: gars.filter((g) => g.contractId === c.id)
        .map((g) => ({
          id: g.id, tipo: g.tipo, poliza: g.poliza, aseguradora: g.aseguradora, estado: g.estado,
          valor: g.valor, porcentaje: g.porcentaje ?? null, fechaInicio: g.fechaInicio ?? null,
          fechaVenc: g.fechaVenc ?? null, anulado: g.estado === 'Anulada',
        })),
      obligations: obs.filter((o) => o.contractId === c.id)
        .map((o) => ({ id: o.id, estado: o.estado, fechaLimite: o.fechaLimite ?? null, anulado: o.estado === 'Anulado' })),
      breaches: brs.filter((b) => b.contractId === c.id)
        .map((b) => ({ id: b.id, estado: b.estado, impacto: b.impacto ?? undefined, anulado: b.estado === 'Anulado' })),
      risks: rgs.filter((r) => r.contractId === c.id)
        .map((r) => ({ id: r.id, prob: r.prob, impacto: r.impacto, estado: r.estado, mitigacion: r.mitigacion ?? null, anulado: r.estado === 'Anulado' })),
      deliverables: dns.filter((d) => d.contractId === c.id)
        .map((d) => ({ id: d.id, estado: d.estado, fechaProg: d.fechaProg ?? null, fechaReal: d.fechaReal ?? null, anulado: d.estado === 'Anulado' })),
      documents: dcs.filter((d) => d.contractId === c.id)
        .map((d) => ({ id: d.id, categoria: d.categoria, estado: d.estado, anulado: d.estado === 'Anulado' })),
      subcontracts: scs.filter((s) => s.contractId === c.id)
        .map((s) => ({ id: s.id, valor: s.valor, fechaFin: s.fechaFin ?? null, estado: s.estado, anulado: s.estado === 'Anulado' })),
      modifications: mds.filter((x) => x.contractId === c.id)
        .map((x) => ({
          id: x.id, tipo: x.tipo, fecha: x.fecha ?? null, valorAnterior: x.valorAnterior ?? null,
          valorNuevo: x.valorNuevo ?? null, fechaNueva: x.fechaNueva ?? null,
          estado: x.estado, anulado: x.estado === 'Anulada',
        })),
      plans: pms.filter((p) => p.contractId === c.id)
        .map((p) => ({ id: p.id, estado: p.estado, avance: p.avance ?? null, anulado: p.estado === 'Anulado' })),
      actas: acs.filter((a) => a.contractId === c.id)
        .map((a) => ({ id: a.id, tipo: a.tipo, estado: a.estado, anulado: a.estado === 'Anulada' })),
      auditCount: conteos.get(c.id) ?? 0,
    };
  }

  base(c: ContractEntity): ContractBase {
    return {
      id: c.id,
      numero: c.numero,
      estado: c.estado,
      anulado: c.anulado,
      fechaFirma: c.fechaFirma ?? null,
      fechaInicio: c.fechaInicio ?? null,
      fechaFin: c.fechaFin ?? null,
      valorBase: c.valorBase,
      iva: c.iva,
      otrosImp: c.otrosImp,
      adiciones: c.adiciones,
      reducciones: c.reducciones,
      avanceFisico: c.avanceFisico ?? null,
      contratista: c.contratista,
      nitContratista: c.nitContratista,
      objeto: c.objeto,
      responsable: c.responsable,
      supervisor: c.supervisor,
      deptos: c.deptos ?? [],
    };
  }
}
