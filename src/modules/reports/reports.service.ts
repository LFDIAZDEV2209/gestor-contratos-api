import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Response } from 'express';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { ContractEntity } from '../contracts/entities/contract.entity';
import { PaymentEntity } from '../contracts/entities/payments.entity';
import { GuaranteeEntity } from '../contracts/entities/guarantees.entity';
import { CupoEntity } from '../contracts/entities/quotas.entity';
import { SubcontractEntity } from '../contracts/entities/subcontracts.entity';
import { ObligationEntity } from '../contracts/entities/obligations.entity';
import { DeliverableEntity } from '../contracts/entities/deliverables.entity';
import { ActaEntity } from '../contracts/entities/actas.entity';
import { ModificationEntity } from '../contracts/entities/modifications.entity';
import { RiskEntity } from '../contracts/entities/risks.entity';
import { BreachEntity } from '../contracts/entities/breaches.entity';
import { PlanEntity } from '../contracts/entities/plans.entity';
import { CompanyEntity } from '../companies/companies.entity';
import { AuditLogEntity } from '../audit/audit.entity';
import { ContractsService } from '../contracts/contracts.service';
import { InsuranceService } from '../insurance/insurance.service';
import { GeoService } from '../geo/geo.service';
import { RolesService } from '../roles/roles.service';
import { SettingsService } from '../settings/settings.service';
import { ContractContextLoader } from '../contracts/contract-context.loader';
import { Prohibido } from '../../common/exceptions/api-exception';
import { ReqContext } from '../../common/req-context';
import { AuditService } from '../audit/audit.service';
import { hoyISO, redondear1 } from '../../common/dates';
import { nivelRiesgo } from '../../engines/types';


export interface Columna {
  key: string;
  label: string;
  tipo?: 'texto' | 'dinero' | 'pct' | 'fecha' | 'numero';
  ancho?: number;
}

export interface Reporte {
  key: string;
  titulo: string;
  columnas: Columna[];
  filas: Record<string, unknown>[];
}

export const CLAVES_REPORTE = [
  'r_general', 'r_empresa', 'r_estado', 'r_anio', 'r_proximos', 'r_fin', 'r_cont',
  'r_pagos', 'r_gar', 'r_inc', 'r_rg', 'r_sub', 'r_aud', 'r_resp', 'r_aseg',
  'r_aseg_det', 'r_cupos', 'r_region', 'r_sup',
] as const;
export type ClaveReporte = (typeof CLAVES_REPORTE)[number];

/** Reportes del módulo Reportes (19 claves) con exportación json/xlsx/pdf en servidor. */
@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(ContractEntity) private readonly contracts: Repository<ContractEntity>,
    @InjectRepository(PaymentEntity) private readonly pagos: Repository<PaymentEntity>,
    @InjectRepository(GuaranteeEntity) private readonly gars: Repository<GuaranteeEntity>,
    @InjectRepository(CupoEntity) private readonly cuposRepo: Repository<CupoEntity>,
    @InjectRepository(CompanyEntity) private readonly empresas: Repository<CompanyEntity>,
    @InjectRepository(SubcontractEntity) private readonly subs: Repository<SubcontractEntity>,
    @InjectRepository(ObligationEntity) private readonly obls: Repository<ObligationEntity>,
    @InjectRepository(DeliverableEntity) private readonly dels: Repository<DeliverableEntity>,
    @InjectRepository(ActaEntity) private readonly actas: Repository<ActaEntity>,
    @InjectRepository(ModificationEntity) private readonly mods: Repository<ModificationEntity>,
    @InjectRepository(RiskEntity) private readonly risks: Repository<RiskEntity>,
    @InjectRepository(BreachEntity) private readonly breaches: Repository<BreachEntity>,
    @InjectRepository(PlanEntity) private readonly plans: Repository<PlanEntity>,
    @InjectRepository(AuditLogEntity) private readonly auditRepo: Repository<AuditLogEntity>,
    private readonly contratos: ContractsService,
    private readonly insurance: InsuranceService,
    private readonly geo: GeoService,
    private readonly roles: RolesService,
    private readonly settings: SettingsService,
    private readonly loader: ContractContextLoader,
    private readonly audit: AuditService,
  ) {}

  async construir(key: string): Promise<Reporte> {
    switch (key) {
      case 'r_general': return this.rGeneral();
      case 'r_empresa': return this.rEmpresa();
      case 'r_estado': return this.rEstado();
      case 'r_anio': return this.rAnio();
      case 'r_proximos': return this.rProximos();
      case 'r_fin': return this.rFin();
      case 'r_cont': return this.rCont();
      case 'r_pagos': return this.rPagos();
      case 'r_gar': return this.rGar();
      case 'r_inc': return this.rInc();
      case 'r_rg': return this.rRg();
      case 'r_sub': return this.rSub();
      case 'r_aud': return this.rAud();
      case 'r_resp': return this.rResp();
      case 'r_aseg': return this.rAseg();
      case 'r_aseg_det': return this.rAsegDet();
      case 'r_cupos': return this.rCupos();
      case 'r_region': return this.rRegion();
      case 'r_sup': return this.rSup();
      default: throw new NotFoundException(`El reporte ${key} no existe.`);
    }
  }

  async responder(key: string, format: string, res: Response, ctx: ReqContext): Promise<void> {
    if (key === 'r_aud' && !(await this.roles.tienePermiso(ctx.rol, 'AUDITAR'))) {
      throw new Prohibido('El reporte de auditoría requiere el permiso AUDITAR.');
    }
    const reporte = await this.construir(key);
    const hoy = hoyISO();
    if (format === 'xlsx') {
      const buffer = await this.aExcel(reporte);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${key}-${hoy}.xlsx"`);
      await this.audit.registrar(ctx, [{ modulo: 'Reportes', accion: 'EXPORTAR', obs: `${key} (xlsx)` }]);
      res.send(buffer);
      return;
    }
    if (format === 'pdf') {
      const buffer = await this.aPdf(reporte);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${key}-${hoy}.pdf"`);
      await this.audit.registrar(ctx, [{ modulo: 'Reportes', accion: 'EXPORTAR', obs: `${key} (pdf)` }]);
      res.send(buffer);
      return;
    }
    await this.audit.registrar(ctx, [{ modulo: 'Reportes', accion: 'CONSULTAR', obs: `${key} (json)` }]);
    res.json({ ...reporte, generado: hoy, total: reporte.filas.length });
  }

  /* ── Definiciones ──────────────────────────────────────────────────────── */

  private async contratosConMetricas() {
    return this.contratos.todasLasFilas();
  }

  private async mapaEmpresas(): Promise<Map<string, CompanyEntity>> {
    const es = await this.empresas.find();
    return new Map(es.map((e) => [e.id, e]));
  }

  private async rGeneral(): Promise<Reporte> {
    const filas = await this.contratosConMetricas();
    const empresas = await this.mapaEmpresas();
    return {
      key: 'r_general',
      titulo: 'Reporte general de contratos',
      columnas: [
        { key: 'numero', label: 'Número', ancho: 90 },
        { key: 'empresa', label: 'Empresa', ancho: 160 },
        { key: 'tipo', label: 'Tipo', ancho: 130 },
        { key: 'contratista', label: 'Contratista', ancho: 160 },
        { key: 'estado', label: 'Estado', ancho: 80 },
        { key: 'valorActual', label: 'Valor actualizado', tipo: 'dinero', ancho: 110 },
        { key: 'ejecutado', label: 'Ejecutado', tipo: 'dinero', ancho: 110 },
        { key: 'saldo', label: 'Saldo', tipo: 'dinero', ancho: 110 },
        { key: 'pctFin', label: '% Fin', tipo: 'pct', ancho: 60 },
        { key: 'pctFis', label: '% Fís', tipo: 'pct', ancho: 60 },
        { key: 'nivel', label: 'Semáforo', ancho: 70 },
      ],
      filas: filas.map((f) => ({
        numero: f.numero,
        empresa: empresas.get(f.companyId)?.razon ?? f.companyId,
        tipo: f.tipo,
        contratista: f.contratista,
        estado: f.metricas.estadoEfectivo,
        valorActual: f.metricas.valorActual,
        ejecutado: f.metricas.ejecutado,
        saldo: f.metricas.saldo,
        pctFin: f.metricas.pctFin,
        pctFis: f.metricas.pctFis,
        nivel: f.metricas.nivel,
      })),
    };
  }

  private async rEmpresa(): Promise<Reporte> {
    const filas = await this.contratosConMetricas();
    const empresas = await this.mapaEmpresas();
    const grupos = new Map<string, { contratos: number; valor: number; ejecutado: number }>();
    for (const f of filas) {
      const g = grupos.get(f.companyId) ?? { contratos: 0, valor: 0, ejecutado: 0 };
      g.contratos += 1;
      g.valor += f.metricas.valorActual;
      g.ejecutado += f.metricas.ejecutado;
      grupos.set(f.companyId, g);
    }
    return {
      key: 'r_empresa',
      titulo: 'Contratos por empresa',
      columnas: [
        { key: 'empresa', label: 'Empresa', ancho: 220 },
        { key: 'nit', label: 'NIT', ancho: 110 },
        { key: 'contratos', label: 'Contratos', tipo: 'numero', ancho: 80 },
        { key: 'valor', label: 'Valor contratado', tipo: 'dinero', ancho: 130 },
        { key: 'ejecutado', label: 'Ejecutado', tipo: 'dinero', ancho: 130 },
        { key: 'saldo', label: 'Saldo', tipo: 'dinero', ancho: 130 },
      ],
      filas: [...grupos.entries()].map(([id, g]) => {
        const e = empresas.get(id);
        return { empresa: e?.razon ?? id, nit: e?.nit ?? '', contratos: g.contratos, valor: g.valor, ejecutado: g.ejecutado, saldo: g.valor - g.ejecutado };
      }).sort((a, b) => b.valor - a.valor),
    };
  }

  private async rEstado(): Promise<Reporte> {
    const filas = await this.contratosConMetricas();
    const grupos = new Map<string, { contratos: number; valor: number }>();
    for (const f of filas) {
      const g = grupos.get(f.metricas.estadoEfectivo) ?? { contratos: 0, valor: 0 };
      g.contratos += 1;
      g.valor += f.metricas.valorActual;
      grupos.set(f.metricas.estadoEfectivo, g);
    }
    return {
      key: 'r_estado',
      titulo: 'Contratos por estado',
      columnas: [
        { key: 'estado', label: 'Estado', ancho: 140 },
        { key: 'contratos', label: 'Contratos', tipo: 'numero', ancho: 90 },
        { key: 'valor', label: 'Valor actualizado', tipo: 'dinero', ancho: 140 },
      ],
      filas: [...grupos.entries()].map(([estado, g]) => ({ estado, contratos: g.contratos, valor: g.valor })),
    };
  }

  private async rAnio(): Promise<Reporte> {
    const filas = await this.contratosConMetricas();
    const grupos = new Map<string, { contratos: number; valor: number }>();
    for (const f of filas) {
      const anio = (f.fechaFirma ?? '').slice(0, 4) || '(sin firma)';
      const g = grupos.get(anio) ?? { contratos: 0, valor: 0 };
      g.contratos += 1;
      g.valor += f.metricas.valorActual;
      grupos.set(anio, g);
    }
    return {
      key: 'r_anio',
      titulo: 'Contratos por año de firma',
      columnas: [
        { key: 'anio', label: 'Año', ancho: 80 },
        { key: 'contratos', label: 'Contratos', tipo: 'numero', ancho: 90 },
        { key: 'valor', label: 'Valor actualizado', tipo: 'dinero', ancho: 140 },
      ],
      filas: [...grupos.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([anio, g]) => ({ anio, contratos: g.contratos, valor: g.valor })),
    };
  }

  private async rProximos(): Promise<Reporte> {
    const filas = await this.contratosConMetricas();
    const empresas = await this.mapaEmpresas();
    const ventana = (dias: number): string => (dias <= 3 ? 'Esta semana' : dias <= 15 ? 'Quincena' : dias <= 30 ? 'Mes' : 'Trimestre');
    return {
      key: 'r_proximos',
      titulo: 'Próximos a vencer',
      columnas: [
        { key: 'numero', label: 'Número', ancho: 90 },
        { key: 'empresa', label: 'Empresa', ancho: 180 },
        { key: 'estado', label: 'Estado', ancho: 80 },
        { key: 'fechaFin', label: 'Terminación', tipo: 'fecha', ancho: 100 },
        { key: 'dias', label: 'Días restantes', tipo: 'numero', ancho: 100 },
        { key: 'ventana', label: 'Ventana', ancho: 100 },
        { key: 'responsable', label: 'Responsable', ancho: 130 },
      ],
      filas: filas
        .filter((f) => f.metricas.estadoEfectivo === 'Activo' && f.metricas.restantes <= 60)
        .sort((a, b) => a.metricas.restantes - b.metricas.restantes)
        .map((f) => ({
          numero: f.numero, empresa: empresas.get(f.companyId)?.razon ?? f.companyId, estado: f.metricas.estadoEfectivo,
          fechaFin: f.fechaFin, dias: f.metricas.restantes, ventana: ventana(f.metricas.restantes), responsable: f.responsable,
        })),
    };
  }

  private async rFin(): Promise<Reporte> {
    const filas = await this.contratosConMetricas();
    return {
      key: 'r_fin',
      titulo: 'Ejecución financiera',
      columnas: [
        { key: 'numero', label: 'Número', ancho: 90 },
        { key: 'valorActual', label: 'Valor actualizado', tipo: 'dinero', ancho: 120 },
        { key: 'ejecutado', label: 'Ejecutado', tipo: 'dinero', ancho: 120 },
        { key: 'pagado', label: 'Pagado', tipo: 'dinero', ancho: 120 },
        { key: 'saldo', label: 'Saldo', tipo: 'dinero', ancho: 120 },
        { key: 'pctFin', label: '% Financiera', tipo: 'pct', ancho: 90 },
        { key: 'pctSaldo', label: '% Saldo', tipo: 'pct', ancho: 80 },
        { key: 'fechaAgotamiento', label: 'Agotamiento est.', tipo: 'fecha', ancho: 110 },
      ],
      filas: filas.map((f) => ({
        numero: f.numero, valorActual: f.metricas.valorActual, ejecutado: f.metricas.ejecutado,
        pagado: f.metricas.pagado, saldo: f.metricas.saldo, pctFin: f.metricas.pctFin,
        pctSaldo: f.metricas.pctSaldo, fechaAgotamiento: f.metricas.fechaAgotamiento,
      })),
    };
  }

  private async rCont(): Promise<Reporte> {
    const filas = await this.contratosConMetricas();
    const grupos = new Map<string, { contratos: number; valor: number }>();
    for (const f of filas) {
      const g = grupos.get(f.modalidad ?? '(sin modalidad)') ?? { contratos: 0, valor: 0 };
      g.contratos += 1;
      g.valor += f.metricas.valorActual;
      grupos.set(f.modalidad ?? '(sin modalidad)', g);
    }
    return {
      key: 'r_cont',
      titulo: 'Contratos por modalidad',
      columnas: [
        { key: 'modalidad', label: 'Modalidad', ancho: 170 },
        { key: 'contratos', label: 'Contratos', tipo: 'numero', ancho: 90 },
        { key: 'valor', label: 'Valor actualizado', tipo: 'dinero', ancho: 140 },
      ],
      filas: [...grupos.entries()].map(([modalidad, g]) => ({ modalidad, contratos: g.contratos, valor: g.valor })),
    };
  }

  private async rPagos(): Promise<Reporte> {
    const [pagos, contratos] = await Promise.all([
      this.pagos.find(),
      this.contracts.find({ select: ['id', 'numero'] }),
    ]);
    const nums = new Map(contratos.map((c) => [c.id, c.numero]));
    return {
      key: 'r_pagos',
      titulo: 'Pagos',
      columnas: [
        { key: 'contrato', label: 'Contrato', ancho: 90 },
        { key: 'pago', label: 'Pago', ancho: 70 },
        { key: 'fecha', label: 'Fecha', tipo: 'fecha', ancho: 90 },
        { key: 'factura', label: 'Factura', ancho: 110 },
        { key: 'bruto', label: 'Bruto', tipo: 'dinero', ancho: 110 },
        { key: 'iva', label: 'IVA', tipo: 'dinero', ancho: 100 },
        { key: 'retenciones', label: 'Retenciones', tipo: 'dinero', ancho: 100 },
        { key: 'neto', label: 'Neto', tipo: 'dinero', ancho: 110 },
        { key: 'estado', label: 'Estado', ancho: 90 },
      ],
      filas: pagos
        .filter((p) => p.estado !== 'Anulado')
        .map((p) => ({
          contrato: nums.get(p.contractId) ?? p.contractId, pago: p.numero, fecha: p.fecha,
          factura: p.factura, bruto: p.bruto, iva: p.iva, retenciones: p.retenciones, neto: p.neto, estado: p.estado,
        })),
    };
  }

  private async rGar(): Promise<Reporte> {
    const [gars, contratos] = await Promise.all([
      this.gars.find(),
      this.contracts.find({ select: ['id', 'numero'] }),
    ]);
    const nums = new Map(contratos.map((c) => [c.id, c.numero]));
    return {
      key: 'r_gar',
      titulo: 'Garantías y pólizas',
      columnas: [
        { key: 'contrato', label: 'Contrato', ancho: 90 },
        { key: 'tipo', label: 'Tipo', ancho: 130 },
        { key: 'aseguradora', label: 'Aseguradora', ancho: 160 },
        { key: 'poliza', label: 'Póliza', ancho: 100 },
        { key: 'modalidad', label: 'Modalidad', ancho: 110 },
        { key: 'valor', label: 'Valor asegurado', tipo: 'dinero', ancho: 120 },
        { key: 'prima', label: 'Prima', tipo: 'dinero', ancho: 100 },
        { key: 'inicio', label: 'Inicio', tipo: 'fecha', ancho: 90 },
        { key: 'venc', label: 'Vence', tipo: 'fecha', ancho: 90 },
        { key: 'estado', label: 'Estado', ancho: 80 },
      ],
      filas: gars.filter((g) => g.estado !== 'Anulada').map((g) => ({
        contrato: nums.get(g.contractId) ?? g.contractId, tipo: g.tipo, aseguradora: g.aseguradora,
        poliza: g.poliza, modalidad: g.modalidadPoliza, valor: g.valor, prima: g.prima,
        inicio: g.fechaInicio, venc: g.fechaVenc, estado: g.estado,
      })),
    };
  }

  private async rInc(): Promise<Reporte> {
    const [incs, contratos] = await Promise.all([
      this.breaches.find(),
      this.contracts.find({ select: ['id', 'numero'] }),
    ]);
    const nums = new Map(contratos.map((c) => [c.id, c.numero]));
    return {
      key: 'r_inc',
      titulo: 'Incumplimientos',
      columnas: [
        { key: 'contrato', label: 'Contrato', ancho: 90 },
        { key: 'fecha', label: 'Fecha', tipo: 'fecha', ancho: 90 },
        { key: 'tipo', label: 'Tipo', ancho: 140 },
        { key: 'descripcion', label: 'Descripción', ancho: 220 },
        { key: 'impacto', label: 'Impacto', ancho: 70 },
        { key: 'estado', label: 'Estado', ancho: 90 },
        { key: 'multa', label: 'Multa', tipo: 'dinero', ancho: 100 },
      ],
      filas: incs.filter((i) => i.estado !== 'Anulado').map((i) => ({
        contrato: nums.get(i.contractId) ?? i.contractId, fecha: i.fecha, tipo: i.tipo,
        descripcion: i.descripcion, impacto: i.impacto, estado: i.estado, multa: i.multa,
      })),
    };
  }

  private async rRg(): Promise<Reporte> {
    const [riesgos, contratos] = await Promise.all([
      this.risks.find(),
      this.contracts.find({ select: ['id', 'numero'] }),
    ]);
    const nums = new Map(contratos.map((c) => [c.id, c.numero]));
    return {
      key: 'r_rg',
      titulo: 'Riesgos',
      columnas: [
        { key: 'contrato', label: 'Contrato', ancho: 90 },
        { key: 'categoria', label: 'Categoría', ancho: 130 },
        { key: 'riesgo', label: 'Riesgo', ancho: 200 },
        { key: 'prob', label: 'Prob', tipo: 'numero', ancho: 50 },
        { key: 'impacto', label: 'Imp', tipo: 'numero', ancho: 50 },
        { key: 'nivel', label: 'Nivel', ancho: 90 },
        { key: 'estado', label: 'Estado', ancho: 90 },
        { key: 'tratamiento', label: 'Tratamiento', ancho: 100 },
      ],
      filas: riesgos.filter((r) => r.estado !== 'Anulado').map((r) => ({
        contrato: nums.get(r.contractId) ?? r.contractId, categoria: r.categoria, riesgo: r.riesgo,
        prob: r.prob, impacto: r.impacto, nivel: nivelRiesgo(r.prob, r.impacto), estado: r.estado, tratamiento: r.tratamiento,
      })),
    };
  }

  private async rSub(): Promise<Reporte> {
    const [subs, contratos] = await Promise.all([
      this.subs.find(),
      this.contracts.find({ select: ['id', 'numero'] }),
    ]);
    const nums = new Map(contratos.map((c) => [c.id, c.numero]));
    return {
      key: 'r_sub',
      titulo: 'Subcontratos',
      columnas: [
        { key: 'contrato', label: 'Contrato', ancho: 90 },
        { key: 'numero', label: 'Subcontrato', ancho: 110 },
        { key: 'contratista', label: 'Contratista', ancho: 170 },
        { key: 'valor', label: 'Valor', tipo: 'dinero', ancho: 110 },
        { key: 'inicio', label: 'Inicio', tipo: 'fecha', ancho: 90 },
        { key: 'fin', label: 'Fin', tipo: 'fecha', ancho: 90 },
        { key: 'ejecucion', label: '% Ejecución', tipo: 'pct', ancho: 90 },
        { key: 'estado', label: 'Estado', ancho: 90 },
      ],
      filas: subs.filter((s) => s.estado !== 'Anulado').map((s) => ({
        contrato: nums.get(s.contractId) ?? s.contractId, numero: s.numero, contratista: s.contratista,
        valor: s.valor, inicio: s.fechaInicio, fin: s.fechaFin, ejecucion: s.ejecucion, estado: s.estado,
      })),
    };
  }

  private async rAud(): Promise<Reporte> {
    const filas = await this.auditRepo.find({ order: { id: 'DESC' }, take: 5000 });
    return {
      key: 'r_aud',
      titulo: 'Auditoría',
      columnas: [
        { key: 'fecha', label: 'Fecha', tipo: 'fecha', ancho: 90 },
        { key: 'hora', label: 'Hora', ancho: 70 },
        { key: 'usuario', label: 'Usuario', ancho: 130 },
        { key: 'rol', label: 'Rol', ancho: 110 },
        { key: 'modulo', label: 'Módulo', ancho: 110 },
        { key: 'accion', label: 'Acción', ancho: 90 },
        { key: 'campo', label: 'Campo', ancho: 120 },
        { key: 'anterior', label: 'Anterior', ancho: 120 },
        { key: 'nuevo', label: 'Nuevo', ancho: 120 },
        { key: 'ip', label: 'IP', ancho: 100 },
      ],
      filas: filas.map((a) => ({
        fecha: a.fecha, hora: a.hora, usuario: a.usuario, rol: a.rol, modulo: a.modulo,
        accion: a.accion, campo: a.campo, anterior: a.anterior, nuevo: a.nuevo, ip: a.ip,
      })),
    };
  }

  private async rResp(): Promise<Reporte> {
    const filas = await this.contratosConMetricas();
    const grupos = new Map<string, { contratos: number; valor: number; ejecutado: number }>();
    for (const f of filas) {
      const g = grupos.get(f.responsable) ?? { contratos: 0, valor: 0, ejecutado: 0 };
      g.contratos += 1;
      g.valor += f.metricas.valorActual;
      g.ejecutado += f.metricas.ejecutado;
      grupos.set(f.responsable, g);
    }
    return {
      key: 'r_resp',
      titulo: 'Contratos por responsable',
      columnas: [
        { key: 'responsable', label: 'Responsable', ancho: 160 },
        { key: 'contratos', label: 'Contratos', tipo: 'numero', ancho: 90 },
        { key: 'valor', label: 'Valor actualizado', tipo: 'dinero', ancho: 140 },
        { key: 'ejecutado', label: 'Ejecutado', tipo: 'dinero', ancho: 140 },
        { key: 'saldo', label: 'Saldo', tipo: 'dinero', ancho: 140 },
      ],
      filas: [...grupos.entries()].sort((a, b) => b[1].valor - a[1].valor)
        .map(([responsable, g]) => ({ responsable, contratos: g.contratos, valor: g.valor, ejecutado: g.ejecutado, saldo: g.valor - g.ejecutado })),
    };
  }

  private async rAseg(): Promise<Reporte> {
    const { data } = await this.insurance.resumenAseguradoras();
    return {
      key: 'r_aseg',
      titulo: 'Reporte por aseguradora',
      columnas: [
        { key: 'aseguradora', label: 'Aseguradora', ancho: 180 },
        { key: 'polizas', label: 'Pólizas', tipo: 'numero', ancho: 70 },
        { key: 'contratos', label: 'Contratos', tipo: 'numero', ancho: 80 },
        { key: 'valorAsegurado', label: 'Valor asegurado', tipo: 'dinero', ancho: 130 },
        { key: 'primas', label: 'Primas', tipo: 'dinero', ancho: 110 },
        { key: 'porCupo', label: 'Por cupo', tipo: 'numero', ancho: 80 },
        { key: 'individuales', label: 'Individuales', tipo: 'numero', ancho: 90 },
        { key: 'cupoTotal', label: 'Cupo total', tipo: 'dinero', ancho: 120 },
        { key: 'cupoUtilizado', label: 'Cupo utilizado', tipo: 'dinero', ancho: 120 },
        { key: 'vencen30', label: 'Vencen ≤30 d', tipo: 'numero', ancho: 90 },
        { key: 'vencidas', label: 'Vencidas', tipo: 'numero', ancho: 80 },
      ],
      filas: data.map((d) => ({ ...d })),
    };
  }

  private async rAsegDet(): Promise<Reporte> {
    const [gars, contratos] = await Promise.all([
      this.gars.find(),
      this.contracts.find({ select: ['id', 'numero'] }),
    ]);
    const nums = new Map(contratos.map((c) => [c.id, c.numero]));
    const vivas = gars.filter((g) => g.estado !== 'Anulada');
    vivas.sort((a, b) => a.aseguradora.localeCompare(b.aseguradora) || (nums.get(a.contractId) ?? '').localeCompare(nums.get(b.contractId) ?? ''));
    return {
      key: 'r_aseg_det',
      titulo: 'Pólizas por aseguradora y contrato',
      columnas: [
        { key: 'aseguradora', label: 'Aseguradora', ancho: 180 },
        { key: 'contrato', label: 'Contrato', ancho: 90 },
        { key: 'tipo', label: 'Tipo', ancho: 130 },
        { key: 'poliza', label: 'Póliza', ancho: 100 },
        { key: 'modalidad', label: 'Modalidad', ancho: 110 },
        { key: 'cupo', label: 'Cupo', ancho: 100 },
        { key: 'valor', label: 'Valor asegurado', tipo: 'dinero', ancho: 120 },
        { key: 'venc', label: 'Vence', tipo: 'fecha', ancho: 90 },
        { key: 'estado', label: 'Estado', ancho: 80 },
      ],
      filas: vivas.map((g) => ({
        aseguradora: g.aseguradora, contrato: nums.get(g.contractId) ?? g.contractId, tipo: g.tipo,
        poliza: g.poliza, modalidad: g.modalidadPoliza, cupo: g.cupoId, valor: g.valor, venc: g.fechaVenc, estado: g.estado,
      })),
    };
  }

  private async rCupos(): Promise<Reporte> {
    const cupos = await this.insurance.listarCupos();
    return {
      key: 'r_cupos',
      titulo: 'Cupos por aseguradora',
      columnas: [
        { key: 'numero', label: 'Cupo', ancho: 140 },
        { key: 'aseguradora', label: 'Aseguradora', ancho: 180 },
        { key: 'tomador', label: 'Tomador', ancho: 180 },
        { key: 'total', label: 'Total', tipo: 'dinero', ancho: 120 },
        { key: 'utilizado', label: 'Utilizado', tipo: 'dinero', ancho: 120 },
        { key: 'disponible', label: 'Disponible', tipo: 'dinero', ancho: 120 },
        { key: 'pctUso', label: '% Uso', tipo: 'pct', ancho: 70 },
        { key: 'polizas', label: 'Pólizas', tipo: 'numero', ancho: 70 },
        { key: 'vigencia', label: 'Vigencia', ancho: 160 },
        { key: 'estado', label: 'Estado', ancho: 80 },
      ],
      filas: cupos.map((c) => ({
        numero: c.numero, aseguradora: c.aseguradora, tomador: c.tomador, total: c.valor,
        utilizado: c.calculado.utilizado, disponible: c.calculado.disponible, pctUso: c.calculado.pctUso,
        polizas: c.calculado.polizas, vigencia: `${c.fechaInicio ?? ''} a ${c.fechaVenc ?? ''}`, estado: c.estado,
      })),
    };
  }

  private async rRegion(): Promise<Reporte> {
    const porDepto = await this.geo.departamentos({});
    const filas: Record<string, unknown>[] = [];
    for (const d of porDepto.data) {
      filas.push({
        departamento: d.nombre, region: d.region, contratos: d.contratos, valorContratado: d.valorContratado,
        polizas: d.polizas, valorAsegurado: d.valorAsegurado, clientes: d.clientes,
      });
    }
    for (const r of (await this.geo.regiones({})).data) {
      filas.push({
        departamento: `— ${r.nombre} (región)`, region: r.region, contratos: r.contratos, valorContratado: r.valorContratado,
        polizas: r.polizas, valorAsegurado: r.valorAsegurado, clientes: r.clientes,
      });
    }
    return {
      key: 'r_region',
      titulo: 'Contratos por departamento y región',
      columnas: [
        { key: 'departamento', label: 'Departamento', ancho: 200 },
        { key: 'region', label: 'Región', ancho: 100 },
        { key: 'contratos', label: 'Contratos', tipo: 'numero', ancho: 80 },
        { key: 'valorContratado', label: 'Valor contratado', tipo: 'dinero', ancho: 130 },
        { key: 'polizas', label: 'Pólizas', tipo: 'numero', ancho: 70 },
        { key: 'valorAsegurado', label: 'Valor asegurado', tipo: 'dinero', ancho: 130 },
        { key: 'clientes', label: 'Clientes', tipo: 'numero', ancho: 70 },
      ],
      filas,
    };
  }

  private async rSup(): Promise<Reporte> {
    const filas = await this.contratosConMetricas();
    const grupos = new Map<string, { contratos: number; valor: number; ejecutado: number }>();
    for (const f of filas) {
      const g = grupos.get(f.supervisor) ?? { contratos: 0, valor: 0, ejecutado: 0 };
      g.contratos += 1;
      g.valor += f.metricas.valorActual;
      g.ejecutado += f.metricas.ejecutado;
      grupos.set(f.supervisor, g);
    }
    return {
      key: 'r_sup',
      titulo: 'Contratos por supervisor',
      columnas: [
        { key: 'supervisor', label: 'Supervisor', ancho: 160 },
        { key: 'contratos', label: 'Contratos', tipo: 'numero', ancho: 90 },
        { key: 'valor', label: 'Valor actualizado', tipo: 'dinero', ancho: 140 },
        { key: 'ejecutado', label: 'Ejecutado', tipo: 'dinero', ancho: 140 },
        { key: 'saldo', label: 'Saldo', tipo: 'dinero', ancho: 140 },
      ],
      filas: [...grupos.entries()].sort((a, b) => b[1].valor - a[1].valor)
        .map(([supervisor, g]) => ({ supervisor, contratos: g.contratos, valor: g.valor, ejecutado: g.ejecutado, saldo: g.valor - g.ejecutado })),
    };
  }

  /* ── Render ────────────────────────────────────────────────────────────── */

  private async aExcel(reporte: Reporte): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Nexo · Gestor Integral de Contratos';
    const ws = wb.addWorksheet(reporte.titulo.slice(0, 31));
    ws.columns = reporte.columnas.map((c) => ({ key: c.key, width: Math.max(10, Math.min(40, (c.ancho ?? 100) / 7)) }));
    const encabezado = ws.addRow(reporte.columnas.map((c) => c.label));
    encabezado.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    encabezado.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B6E68' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    });
    for (const f of reporte.filas) {
      const row = ws.addRow(reporte.columnas.map((c) => (f[c.key] ?? '') as string | number));
      reporte.columnas.forEach((c, i) => {
        if (c.tipo === 'dinero') row.getCell(i + 1).numFmt = '#,##0';
        if (c.tipo === 'pct') row.getCell(i + 1).numFmt = '0.0';
      });
    }
    const out = await wb.xlsx.writeBuffer();
    return Buffer.from(out);
  }

  private async aPdf(reporte: Reporte): Promise<Buffer> {
    const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape', bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    const fin = new Promise<Buffer>((resolveP) => doc.on('end', () => resolveP(Buffer.concat(chunks))));

    doc.fontSize(13).font('Helvetica-Bold').text(reporte.titulo, { align: 'left' });
    doc.fontSize(8).font('Helvetica').fillColor('#555555')
      .text(`Generado el ${hoyISO()} · Nexo · Gestor Integral de Contratos`, { continued: false });
    doc.moveDown(0.5);
    doc.fillColor('#000000');

    const total = reporte.columnas.reduce((s, c) => s + (c.ancho ?? 100), 0);
    const disponible = doc.page.width - 60;
    const factor = disponible / total;
    const xs: number[] = [];
    let x = doc.page.margins.left;
    for (const c of reporte.columnas) {
      xs.push(x);
      x += (c.ancho ?? 100) * factor;
    }

    const filaAlta = 14;
    let y = doc.y;
    const dibujarEncabezado = (): void => {
      doc.rect(doc.page.margins.left, y, disponible, filaAlta).fill('#0B6E68');
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(7);
      reporte.columnas.forEach((c, i) => {
        doc.text(c.label, xs[i] + 2, y + 3.5, { width: (c.ancho ?? 100) * factor - 4, ellipsis: true, lineBreak: false });
      });
      doc.fillColor('#000000').font('Helvetica');
      y += filaAlta;
    };
    dibujarEncabezado();

    doc.fontSize(7);
    for (const f of reporte.filas) {
      if (y + filaAlta > doc.page.height - doc.page.margins.bottom) {
        doc.addPage();
        y = doc.page.margins.top;
        dibujarEncabezado();
        doc.fontSize(7);
      }
      const valores = reporte.columnas.map((c) => {
        const v = f[c.key];
        if (v == null || v === '') return '';
        if (c.tipo === 'dinero') return Number(v).toLocaleString('es-CO');
        if (c.tipo === 'pct') return `${v} %`;
        return String(v);
      });
      reporte.columnas.forEach((c, i) => {
        doc.text(valores[i], xs[i] + 2, y + 3.5, { width: (c.ancho ?? 100) * factor - 4, ellipsis: true, lineBreak: false });
      });
      y += filaAlta;
    }
    doc.end();
    return fin;
  }
}
