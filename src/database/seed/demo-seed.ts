import 'reflect-metadata';
import { EntityManager } from 'typeorm';
import { createHash } from 'node:crypto';
import '../pg-types';
import { hoyISO, sumarDias, periodoHace } from '../../common/dates';
import { CompanyEntity } from '../../modules/companies/companies.entity';
import { ContractEntity } from '../../modules/contracts/entities/contract.entity';
import { SubcontractEntity } from '../../modules/contracts/entities/subcontracts.entity';
import { ObligationEntity } from '../../modules/contracts/entities/obligations.entity';
import { DeliverableEntity } from '../../modules/contracts/entities/deliverables.entity';
import { ExecEntity } from '../../modules/contracts/entities/execs.entity';
import { PaymentEntity } from '../../modules/contracts/entities/payments.entity';
import { GuaranteeEntity } from '../../modules/contracts/entities/guarantees.entity';
import { CupoEntity } from '../../modules/contracts/entities/quotas.entity';
import { ActaEntity } from '../../modules/contracts/entities/actas.entity';
import { ModificationEntity } from '../../modules/contracts/entities/modifications.entity';
import { RiskEntity } from '../../modules/contracts/entities/risks.entity';
import { BreachEntity } from '../../modules/contracts/entities/breaches.entity';
import { PlanEntity } from '../../modules/contracts/entities/plans.entity';
import { DocumentEntity, DocumentVersionEntity } from '../../modules/contracts/entities/documents.entity';
import { UserEntity } from '../../modules/users/users.entity';
import { RolePermissionEntity } from '../../modules/roles/roles.entity';
import { SettingEntity, CatalogEntity, CatalogItemEntity } from '../../modules/settings/settings.entity';
import { AuditLogEntity } from '../../modules/audit/audit.entity';
import { CATALOGOS_DEFECTO } from '../../modules/settings/settings.service';
import { PERMISOS, ROLES } from '../../common/decorators';

/* ══════════════════════════════════════════════════════════════════════════
 * Seed de datos demo (files/11). Las fechas se calculan RELATIVAS A HOY:
 * CT-01 vence en 5 días, CT-10 en 3, CT-03 vencido hace 10, etc.
 * ══════════════════════════════════════════════════════════════════════════ */

/** Reparte un total en n partes enteras (para execs y pagos). */
function repartir(total: number, n: number): number[] {
  const base = Math.floor(total / n);
  const filas = Array.from({ length: n }, () => base);
  let resto = total - base * n;
  let i = n - 1;
  while (resto > 0) {
    filas[i] += 1;
    resto -= 1;
    i = i === 0 ? n - 1 : i - 1;
  }
  return filas;
}

interface ConfigContrato {
  id: string; numero: string; tipo: string; modalidad: string; companyId: string;
  contratista: string; nit: string; rep?: string; area?: string; objeto: string;
  descripcion?: string; responsable: string; supervisor: string; interventor?: string;
  deptos: string[]; municipio?: string; firma: number; inicio: number; fin: number;
  hastaAgotar?: boolean; valorActual: number; adiciones?: number; reducciones?: number;
  avanceFisico: number; ejecutado: number; pagado: number; nExecs: number;
}

const CONFIG: ConfigContrato[] = [
  {
    id: 'CT-01', numero: '044-2026', tipo: 'Prestación de servicios de salud', modalidad: 'Contratación directa',
    companyId: 'EMP-01', contratista: 'Unión Temporal Red Salud Norte', nit: '901.778.412-3', rep: 'Néstor Villalba',
    area: 'Salud', objeto: 'Operación de la red de atención primaria en salud para siete departamentos del Caribe y la Andina.',
    descripcion: 'Demo: vence en 5 días con alerta crítica, obligaciones vencidas, tres aseguradoras y pólizas por cupo.',
    responsable: 'Martha Salcedo', supervisor: 'Ricardo Ortiz', interventor: 'Diana Castro',
    deptos: ['08', '13', '47', '20', '44', '70', '23'], municipio: 'Barranquilla',
    firma: -298, inicio: -294, fin: 5, hastaAgotar: true,
    valorActual: 42_186_012_028, avanceFisico: 82, ejecutado: 37_545_550_705, pagado: 33_000_000_000, nExecs: 10,
  },
  {
    id: 'CT-02', numero: '051-2026', tipo: 'Obra civil', modalidad: 'Invitación privada',
    companyId: 'EMP-02', contratista: 'Constructora Barlovento S.A.S.', nit: '900.123.456-1', rep: 'Camilo Duarte',
    area: 'Operaciones', objeto: 'Rehabilitación de la vía lateral al terminal portuario (calzada, drenajes y señalización).',
    responsable: 'Juan Pérez', supervisor: 'Ricardo Ortiz', interventor: 'Diana Castro',
    deptos: ['13'], municipio: 'Cartagena', firma: -200, inicio: -190, fin: 120,
    valorActual: 3_811_500_000, adiciones: 11_500_000, avanceFisico: 45, ejecutado: 2_100_000_000, pagado: 1_800_000_000, nExecs: 8,
  },
  {
    id: 'CT-03', numero: '012-2026', tipo: 'Suministro', modalidad: 'Invitación privada',
    companyId: 'EMP-03', contratista: 'Distribuidora Agroindustrial del Caribe Ltda.', nit: '830.994.112-0', rep: 'Elda Peralta',
    area: 'Compras', objeto: 'Suministro de insumos agroindustriales para las bodegas del Atlántico y el Magdalena.',
    responsable: 'Andrés Gómez', supervisor: 'Martha Salcedo',
    deptos: ['08', '13', '47', '20'], municipio: 'Barranquilla', firma: -320, inicio: -310, fin: -10,
    valorActual: 1_166_200_000, avanceFisico: 96, ejecutado: 1_120_000_000, pagado: 1_100_000_000, nExecs: 6,
  },
  {
    id: 'CT-04', numero: '067-2026', tipo: 'Consultoría', modalidad: 'Contratación directa',
    companyId: 'EMP-02', contratista: 'Analítica Energética Consultores S.A.S.', nit: '901.455.220-2', rep: 'Óscar Valdés',
    area: 'Tecnología', objeto: 'Consultoría de analítica de consumo energético y balance de cargas.',
    responsable: 'Juan Pérez', supervisor: 'Martha Salcedo',
    deptos: ['08', '11'], municipio: 'Bogotá, D.C.', firma: -150, inicio: -140, fin: 95,
    valorActual: 725_900_000, avanceFisico: 40, ejecutado: 290_360_000, pagado: 200_000_000, nExecs: 3,
  },
  {
    id: 'CT-05', numero: '023-2026', tipo: 'Interventoría', modalidad: 'Contratación directa',
    companyId: 'EMP-04', contratista: 'Interventorías del Norte S.A.S.', nit: '901.990.003-5', rep: 'Luisa Ferreira',
    area: 'Gerencia', objeto: 'Interventoría técnica y administrativa del plan de expansión portuaria.',
    responsable: 'Laura Méndez', supervisor: 'Ricardo Ortiz',
    deptos: ['13', '08'], municipio: 'Cartagena', firma: -380, inicio: -370, fin: 8,
    valorActual: 642_600_000, avanceFisico: 98, ejecutado: 636_174_000, pagado: 600_000_000, nExecs: 9,
  },
  {
    id: 'CT-06', numero: '078-2026', tipo: 'Mantenimiento', modalidad: 'Invitación privada',
    companyId: 'EMP-03', contratista: 'Mantenimientos Industriales Arauca S.A.S.', nit: '900.771.221-9', rep: 'Fabio Camargo',
    area: 'Operaciones', objeto: 'Mantenimiento preventivo y correctivo de subestaciones eléctricas.',
    responsable: 'Martha Salcedo', supervisor: 'Ricardo Ortiz',
    deptos: ['81', '85', '54'], municipio: 'Arauca', firma: -260, inicio: -250, fin: 75,
    valorActual: 1_487_500_000, avanceFisico: 60, ejecutado: 1_041_250_000, pagado: 900_000_000, nExecs: 8,
  },
  {
    id: 'CT-07', numero: '089-2026', tipo: 'Tecnología y licenciamiento', modalidad: 'Invitación privada',
    companyId: 'EMP-02', contratista: 'Soluciones Digitales Kairos S.A.S.', nit: '901.040.876-4', rep: 'Inés Barrios',
    area: 'Tecnología', objeto: 'Modernización del ERP: licenciamiento, migración de datos y capacitación.',
    descripcion: 'Demo: contrato en curso con entregables y cronograma (Gantt).',
    responsable: 'Juan Pérez', supervisor: 'Martha Salcedo',
    deptos: ['08', '11', '05', '76'], municipio: 'Barranquilla', firma: -100, inicio: -90, fin: 270,
    valorActual: 1_059_100_000, avanceFisico: 30, ejecutado: 476_595_000, pagado: 400_000_000, nExecs: 8,
  },
  {
    id: 'CT-08', numero: '031-2025', tipo: 'Arrendamiento', modalidad: 'Contratación directa',
    companyId: 'EMP-04', contratista: 'Inmobiliaria Puerta de Oro S.A.S.', nit: '901.220.118-7', rep: 'Hernán Suárez',
    area: 'Operaciones', objeto: 'Arrendamiento de bodegas logísticas para el centro de distribución.',
    responsable: 'Andrés Gómez', supervisor: 'Martha Salcedo',
    deptos: ['08'], municipio: 'Barranquilla', firma: -500, inicio: -490, fin: -80,
    valorActual: 571_200_000, avanceFisico: 100, ejecutado: 571_200_000, pagado: 571_200_000, nExecs: 5,
  },
  {
    id: 'CT-09', numero: '095-2026', tipo: 'Transporte', modalidad: 'Invitación pública',
    companyId: 'EMP-05', contratista: 'Transportes Magdalena Express S.A.S.', nit: '860.034.556-3', rep: 'Marta Ibáñez',
    area: 'Operaciones', objeto: 'Transporte de carga terrestre entre el Magdalena y el interior del país.',
    responsable: 'Andrés Gómez', supervisor: 'Ricardo Ortiz',
    deptos: ['47', '08', '25', '68', '05', '50'], municipio: 'Santa Marta', firma: -120, inicio: -110, fin: 65,
    valorActual: 499_800_000, adiciones: 39_800_000, avanceFisico: 88, ejecutado: 524_790_000, pagado: 500_000_000, nExecs: 4,
  },
  {
    id: 'CT-10', numero: '102-2026', tipo: 'Prestación de servicios', modalidad: 'Contratación directa',
    companyId: 'EMP-01', contratista: 'Asesorías Jurídicas Barros & Asociados', nit: '900.885.124-6', rep: 'Tulio Barros',
    area: 'Jurídica', objeto: 'Asesoría jurídica permanente en contratación estatal para la gerencia.',
    responsable: 'Laura Méndez', supervisor: 'Ricardo Ortiz',
    deptos: ['08', '11'], municipio: 'Barranquilla', firma: -88, inicio: -80, fin: 3,
    valorActual: 171_360_000, avanceFisico: 85, ejecutado: 154_224_000, pagado: 120_000_000, nExecs: 3,
  },
];

/** valorBase/iva para que valorInicial = valorActual objetivo exacto. */
function partir(valorActual: number, adiciones = 0): { valorBase: number; iva: number } {
  const valorInicial = valorActual - adiciones;
  const valorBase = Math.floor(valorInicial / 1.19);
  return { valorBase, iva: valorInicial - valorBase };
}

export async function sembrarDatosDemo(manager: EntityManager): Promise<void> {
  // Idempotente: si ya hay datos, no repite el seed.
  if ((await manager.getRepository(UserEntity).count()) > 0) return;

  const hoy = hoyISO();
  const d = (n: number): string => sumarDias(hoy, n);

  /* ── Usuarios (files/08) ─────────────────────────────────────────────── */
  const usuarios: [string, string, string, string][] = [
    ['U1', 'Laura Méndez', 'lmendez@empresa.co', 'ADMINISTRADOR'],
    ['U2', 'Juan Pérez', 'jperez@empresa.co', 'CONTRATACIÓN'],
    ['U3', 'Carolina Ríos', 'crios@empresa.co', 'JURÍDICA'],
    ['U4', 'Andrés Gómez', 'agomez@empresa.co', 'FINANCIERA'],
    ['U5', 'Martha Salcedo', 'msalcedo@empresa.co', 'SUPERVISOR'],
    ['U6', 'Ricardo Ortiz', 'rortiz@empresa.co', 'INTERVENTOR'],
    ['U7', 'Diana Castro', 'dcastro@empresa.co', 'AUDITOR'],
    ['U8', 'Pedro Llanos', 'pllanos@empresa.co', 'CONSULTA'],
  ];
  await manager.getRepository(UserEntity).insert(usuarios.map(([id, nombre, email, rol]) =>
    manager.getRepository(UserEntity).create({ id, nombre, email, rol, estado: 'Activo', version: 1 }),
  ));

  /* ── Matriz de permisos (files/08) ──────────────────────────────────── */
  const porDefecto: Record<string, PermisoEstado> = {
    ADMINISTRADOR: ['VER', 'CREAR', 'EDITAR', 'APROBAR', 'ANULAR', 'EXPORTAR', 'AUDITAR'],
    CONTRATACIÓN: ['VER', 'CREAR', 'EDITAR', 'EXPORTAR'],
    JURÍDICA: ['VER', 'CREAR', 'EDITAR', 'APROBAR', 'ANULAR', 'EXPORTAR'],
    FINANCIERA: ['VER', 'CREAR', 'EDITAR', 'APROBAR', 'EXPORTAR'],
    SUPERVISOR: ['VER', 'CREAR', 'EDITAR', 'APROBAR', 'EXPORTAR'],
    INTERVENTOR: ['VER', 'CREAR', 'EDITAR', 'EXPORTAR'],
    AUDITOR: ['VER', 'EXPORTAR', 'AUDITAR'],
    CONSULTA: ['VER'],
  };
  const perms: RolePermissionEntity[] = [];
  for (const rol of ROLES) {
    for (const p of PERMISOS) {
      perms.push(manager.getRepository(RolePermissionEntity).create({
        rol, permiso: p, habilitado: (porDefecto[rol] ?? []).includes(p),
      }));
    }
  }
  await manager.getRepository(RolePermissionEntity).insert(perms);

  /* ── Configuración y catálogos ──────────────────────────────────────── */
  await manager.getRepository(SettingEntity).insert({
    id: 1, alertDays: [30, 15, 10, 5, 3, 1], criticalDays: 5, budgetPct: 15, gapPct: 20,
  } as SettingEntity);
  for (const [nombre, valores] of Object.entries(CATALOGOS_DEFECTO)) {
    await manager.getRepository(CatalogEntity).insert({ nombre } as CatalogEntity);
    await manager.getRepository(CatalogItemEntity).insert(
      valores.map((valor, i) => manager.getRepository(CatalogItemEntity).create({ catalogNombre: nombre, valor, orden: i })),
    );
  }

  /* ── Empresas (files/11) ────────────────────────────────────────────── */
  const empresas: [string, string, string, string][] = [
    ['EMP-01', 'Salud Integral del Caribe IPS S.A.S.', '900.451.328-7', 'Barranquilla'],
    ['EMP-02', 'Grupo Andino de Infraestructura S.A.S.', '901.203.884-1', 'Barranquilla'],
    ['EMP-03', 'Energía Costa Norte S.A. E.S.P.', '800.332.109-4', 'Barranquilla'],
    ['EMP-04', 'Logística Portuaria del Atlántico S.A.S.', '901.587.662-9', 'Barranquilla'],
    ['EMP-05', 'Alimentos del Litoral S.A.', '890.104.775-2', 'Soledad'],
  ];
  await manager.getRepository(CompanyEntity).insert(empresas.map(([id, razon, nit, ciudad]) =>
    manager.getRepository(CompanyEntity).create({
      id, razon, nit, tipo: 'Sociedad comercial', ciudad, depto: '08', pais: 'Colombia',
      estado: 'Activa', fechaCreacion: d(-400), version: 1,
    }),
  ));

  /* ── Cupos (files/11) ───────────────────────────────────────────────── */
  await manager.getRepository(CupoEntity).insert([
    { id: 'CP-01', aseguradora: 'Seguros del Estado S.A.', numero: 'CUPO-SE-2026-118', tomador: 'Unión Temporal Red Salud Norte', intermediario: 'Delima Marsh S.A.', valor: 11_000_000_000, fechaInicio: d(-300), fechaVenc: d(65), estado: 'Vigente', observaciones: 'Cupo corporativo del grupo de salud.', version: 1 },
    { id: 'CP-02', aseguradora: 'Mundial de Seguros S.A.', numero: 'CUPO-MS-0457', tomador: 'Constructora Barlovento S.A.S.', intermediario: 'Interaseguros S.A.', valor: 2_400_000_000, fechaInicio: d(-200), fechaVenc: d(160), estado: 'Vigente', version: 1 },
    { id: 'CP-03', aseguradora: 'Seguros Generales Suramericana (SURA)', numero: 'CUPO-SURA-77120', tomador: 'Grupo empresarial (cupo corporativo)', intermediario: 'SURA Brokers', valor: 3_500_000_000, fechaInicio: d(-280), fechaVenc: d(85), estado: 'Vigente', version: 1 },
    { id: 'CP-04', aseguradora: 'Seguros Bolívar S.A.', numero: 'CUPO-SB-3391', tomador: 'Mantenimientos Industriales Arauca S.A.S.', intermediario: 'Bolívar Corredores', valor: 250_000_000, fechaInicio: d(-255), fechaVenc: d(30), estado: 'Vigente', observaciones: 'Cupo al límite: 89 % de uso.', version: 1 },
    { id: 'CP-05', aseguradora: 'Liberty Seguros S.A.', numero: 'CUPO-LB-5520', tomador: 'Transportes Magdalena Express S.A.S.', intermediario: 'Liberty Brokerage', valor: 400_000_000, fechaInicio: d(-115), fechaVenc: d(90), estado: 'Vigente', version: 1 },
  ]);

  /* ── Contratos ──────────────────────────────────────────────────────── */
  const contratosRepo = manager.getRepository(ContractEntity);
  for (const cfg of CONFIG) {
    const { valorBase, iva } = partir(cfg.valorActual, cfg.adiciones ?? 0);
    await contratosRepo.insert(contratosRepo.create({
      id: cfg.id,
      numero: cfg.numero,
      tipo: cfg.tipo,
      modalidad: cfg.modalidad,
      companyId: cfg.companyId,
      estado: cfg.id === 'CT-04' ? 'Suspendido' : cfg.id === 'CT-05' ? 'En liquidación' : cfg.id === 'CT-08' ? 'Liquidado' : 'Activo',
      contratista: cfg.contratista,
      nitContratista: cfg.nit,
      repContratista: cfg.rep ?? null,
      area: cfg.area ?? null,
      objeto: cfg.objeto,
      descripcion: cfg.descripcion ?? null,
      responsable: cfg.responsable,
      supervisor: cfg.supervisor,
      interventor: cfg.interventor ?? null,
      deptos: cfg.deptos,
      municipio: cfg.municipio ?? null,
      fechaFirma: d(cfg.firma),
      fechaInicio: d(cfg.inicio),
      fechaFin: d(cfg.fin),
      hastaAgotar: !!cfg.hastaAgotar,
      valorBase,
      iva,
      otrosImp: 0,
      adiciones: cfg.adiciones ?? 0,
      reducciones: cfg.reducciones ?? 0,
      avanceFisico: cfg.avanceFisico,
      version: 1,
    }));
  }

  /* ── Ejecución mensual y pagos ──────────────────────────────────────── */
  const execsRepo = manager.getRepository(ExecEntity);
  const pagosRepo = manager.getRepository(PaymentEntity);
  for (const cfg of CONFIG) {
    const vals = repartir(cfg.ejecutado, cfg.nExecs);
    const meses = periodoDesde(d(cfg.inicio), cfg.nExecs);
    for (let i = 0; i < cfg.nExecs; i++) {
      const avance = Math.round(((i + 1) / cfg.nExecs) * cfg.avanceFisico * 100) / 100;
      await execsRepo.insert(execsRepo.create({
        id: `EX-${cfg.id.slice(3)}-${String(i + 1).padStart(2, '0')}`,
        contractId: cfg.id, periodo: meses[i], valor: vals[i], avanceFisico: avance,
        obs: i === cfg.nExecs - 1 ? 'Último reporte de ejecución.' : null, version: 1,
      }));

      const esUltimo = i >= cfg.nExecs - 2 && cfg.id !== 'CT-08';
      const bruto = vals[i];
      const ivaP = Math.round(bruto * 0.19);
      const ret = Math.round(bruto * 0.04);
      await pagosRepo.insert(pagosRepo.create({
        id: `PG-${cfg.id.slice(3)}-${String(i + 1).padStart(2, '0')}`,
        contractId: cfg.id,
        numero: `P-${String(i + 1).padStart(2, '0')}-${cfg.numero.slice(0, 3)}${cfg.numero.slice(4)}`,
        fecha: d(cfg.inicio + (i + 1) * 15),
        factura: `FV-${cfg.numero.slice(0, 3)}-${String(10_000 + i)}`,
        periodo: meses[i],
        bruto, iva: ivaP, retenciones: ret, neto: bruto + ivaP - ret,
        estado: esUltimo ? (i === cfg.nExecs - 1 ? 'Pendiente' : 'En revisión') : 'Pagado',
        fechaAprob: esUltimo ? null : d(cfg.inicio + (i + 1) * 15 + 3),
        fechaPago: esUltimo ? null : d(cfg.inicio + (i + 1) * 15 + 8),
        soporte: esUltimo ? null : `soporte-${cfg.id.slice(3)}-${i + 1}.pdf`,
        version: 1,
      }));
    }
  }

  /* ── Garantías (23) ─────────────────────────────────────────────────── */
  await manager.getRepository(GuaranteeEntity).insert([
    // CT-01 · Seguros del Estado (por cupo CP-01) + SURA (CP-03) + Bolívar (individual)
    { id: 'GR-01', contractId: 'CT-01', tipo: 'Cumplimiento', aseguradora: 'Seguros del Estado S.A.', poliza: 'PL-431371', modalidadPoliza: 'Póliza por cupo', cupoId: 'CP-01', porcentaje: 10, tomador: 'Unión Temporal Red Salud Norte', intermediario: 'Delima Marsh S.A.', prima: 16_874_405, valor: 4_218_601_203, fechaExp: d(-296), fechaInicio: d(-294), fechaVenc: d(420), estado: 'Aprobada', version: 1 },
    { id: 'GR-02', contractId: 'CT-01', tipo: 'Manejo de anticipo', aseguradora: 'Seguros del Estado S.A.', poliza: 'PL-431372', modalidadPoliza: 'Póliza por cupo', cupoId: 'CP-01', porcentaje: 10, tomador: 'Unión Temporal Red Salud Norte', intermediario: 'Delima Marsh S.A.', prima: 14_400_000, valor: 4_218_601_203, fechaExp: d(-296), fechaInicio: d(-294), fechaVenc: d(420), estado: 'Aprobada', version: 1 },
    { id: 'GR-03', contractId: 'CT-01', tipo: 'Calidad', aseguradora: 'Seguros Generales Suramericana (SURA)', poliza: 'PL-77120A', modalidadPoliza: 'Póliza por cupo', cupoId: 'CP-03', porcentaje: 5, tomador: 'Unión Temporal Red Salud Norte', intermediario: 'SURA Brokers', prima: 9_000_000, valor: 2_380_000_000, fechaExp: d(-290), fechaInicio: d(-294), fechaVenc: d(180), estado: 'Aprobada', version: 1 },
    { id: 'GR-04', contractId: 'CT-01', tipo: 'Responsabilidad civil', aseguradora: 'Seguros Bolívar S.A.', poliza: 'PL-88210', modalidadPoliza: 'Póliza individual', porcentaje: 3, tomador: 'Unión Temporal Red Salud Norte', intermediario: 'Bolívar Corredores', prima: 8_000_000, valor: 800_000_000, fechaExp: d(-285), fechaInicio: d(-294), fechaVenc: d(200), estado: 'Aprobada', version: 1 },
    // CT-02 · Mundial (por cupo CP-02) + Allianz (individual) + SURA anticipo (CP-03)
    { id: 'GR-05', contractId: 'CT-02', tipo: 'Cumplimiento', aseguradora: 'Mundial de Seguros S.A.', poliza: 'PL-99201', modalidadPoliza: 'Póliza por cupo', cupoId: 'CP-02', porcentaje: 43, tomador: 'Constructora Barlovento S.A.S.', intermediario: 'Interaseguros S.A.', prima: 12_000_000, valor: 1_650_000_000, fechaExp: d(-188), fechaInicio: d(-190), fechaVenc: d(200), estado: 'Aprobada', version: 1 },
    { id: 'GR-06', contractId: 'CT-02', tipo: 'Estabilidad', aseguradora: 'Mundial de Seguros S.A.', poliza: 'PL-99202', modalidadPoliza: 'Póliza por cupo', cupoId: 'CP-02', porcentaje: 6, tomador: 'Constructora Barlovento S.A.S.', intermediario: 'Interaseguros S.A.', prima: 3_000_000, valor: 220_000_000, fechaExp: d(-150), fechaInicio: d(-150), fechaVenc: d(200), estado: 'Pendiente', version: 1 },
    { id: 'GR-07', contractId: 'CT-02', tipo: 'Todo riesgo', aseguradora: 'Allianz Seguros S.A.', poliza: 'PL-40155', modalidadPoliza: 'Póliza individual', porcentaje: 37, tomador: 'Constructora Barlovento S.A.S.', intermediario: 'Allianz Brokers', prima: 18_000_000, valor: 1_400_000_000, fechaExp: d(-188), fechaInicio: d(-190), fechaVenc: d(150), estado: 'Aprobada', version: 1 },
    { id: 'GR-08', contractId: 'CT-02', tipo: 'Manejo de anticipo', aseguradora: 'Seguros Generales Suramericana (SURA)', poliza: 'PL-77430', modalidadPoliza: 'Póliza por cupo', cupoId: 'CP-03', porcentaje: 8, tomador: 'Constructora Barlovento S.A.S.', intermediario: 'SURA Brokers', prima: 4_000_000, valor: 300_000_000, fechaExp: d(-170), fechaInicio: d(-170), fechaVenc: d(200), estado: 'Aprobada', version: 1 },
    // CT-03 · Liberty (individual) + Mapfre — garantía de cumplimiento vencida
    { id: 'GR-09', contractId: 'CT-03', tipo: 'Cumplimiento', aseguradora: 'Liberty Seguros S.A.', poliza: 'PL-20114', modalidadPoliza: 'Póliza individual', porcentaje: 10, tomador: 'Distribuidora Agroindustrial del Caribe Ltda.', intermediario: 'Liberty Brokerage', prima: 4_000_000, valor: 116_620_000, fechaExp: d(-318), fechaInicio: d(-310), fechaVenc: d(-2), estado: 'Aprobada', version: 1 },
    { id: 'GR-10', contractId: 'CT-03', tipo: 'Manejo de anticipo', aseguradora: 'Liberty Seguros S.A.', poliza: 'PL-20115', modalidadPoliza: 'Póliza individual', porcentaje: 8, tomador: 'Distribuidora Agroindustrial del Caribe Ltda.', intermediario: 'Liberty Brokerage', prima: 3_000_000, valor: 98_000_000, fechaExp: d(-318), fechaInicio: d(-310), fechaVenc: d(40), estado: 'Aprobada', version: 1 },
    { id: 'GR-11', contractId: 'CT-03', tipo: 'Responsabilidad civil', aseguradora: 'Mapfre Seguros Generales', poliza: 'PL-66012', modalidadPoliza: 'Póliza individual', porcentaje: 15, tomador: 'Distribuidora Agroindustrial del Caribe Ltda.', prima: 5_000_000, valor: 200_000_000, fechaExp: d(-318), fechaInicio: d(-310), fechaVenc: d(40), estado: 'Aprobada', version: 1 },
    // CT-04 · Bolívar + AXA (individuales; el cupo Bolívar es de otro tomador)
    { id: 'GR-12', contractId: 'CT-04', tipo: 'Cumplimiento', aseguradora: 'Seguros Bolívar S.A.', poliza: 'PL-77330', modalidadPoliza: 'Póliza individual', porcentaje: 10, tomador: 'Analítica Energética Consultores S.A.S.', intermediario: 'Bolívar Corredores', prima: 2_500_000, valor: 72_590_000, fechaExp: d(-148), fechaInicio: d(-140), fechaVenc: d(95), estado: 'Aprobada', version: 1 },
    { id: 'GR-13', contractId: 'CT-04', tipo: 'Responsabilidad civil', aseguradora: 'AXA Colpatria Seguros', poliza: 'PL-51009', modalidadPoliza: 'Póliza individual', porcentaje: 14, tomador: 'Analítica Energética Consultores S.A.S.', prima: 2_000_000, valor: 100_000_000, fechaExp: d(-148), fechaInicio: d(-140), fechaVenc: d(95), estado: 'Aprobada', version: 1 },
    // CT-05 · La Previsora (individual)
    { id: 'GR-14', contractId: 'CT-05', tipo: 'Cumplimiento', aseguradora: 'La Previsora S.A.', poliza: 'PL-30011', modalidadPoliza: 'Póliza individual', porcentaje: 10, tomador: 'Interventorías del Norte S.A.S.', prima: 2_000_000, valor: 64_260_000, fechaExp: d(-378), fechaInicio: d(-370), fechaVenc: d(8), estado: 'Aprobada', version: 1 },
    // CT-06 · Bolívar (por cupo CP-04) + Chubb
    { id: 'GR-15', contractId: 'CT-06', tipo: 'Cumplimiento', aseguradora: 'Seguros Bolívar S.A.', poliza: 'PL-77441', modalidadPoliza: 'Póliza por cupo', cupoId: 'CP-04', porcentaje: 10, tomador: 'Mantenimientos Industriales Arauca S.A.S.', intermediario: 'Bolívar Corredores', prima: 3_000_000, valor: 148_750_000, fechaExp: d(-258), fechaInicio: d(-250), fechaVenc: d(12), estado: 'Aprobada', version: 1 },
    { id: 'GR-16', contractId: 'CT-06', tipo: 'Salarios y prestaciones', aseguradora: 'Seguros Bolívar S.A.', poliza: 'PL-77442', modalidadPoliza: 'Póliza por cupo', cupoId: 'CP-04', porcentaje: 5, tomador: 'Mantenimientos Industriales Arauca S.A.S.', intermediario: 'Bolívar Corredores', prima: 1_500_000, valor: 74_375_000, fechaExp: d(-258), fechaInicio: d(-250), fechaVenc: d(95), estado: 'Aprobada', version: 1 },
    { id: 'GR-17', contractId: 'CT-06', tipo: 'Responsabilidad civil', aseguradora: 'Chubb Seguros Colombia', poliza: 'PL-90112', modalidadPoliza: 'Póliza individual', porcentaje: 20, tomador: 'Mantenimientos Industriales Arauca S.A.S.', prima: 4_500_000, valor: 300_000_000, fechaExp: d(-258), fechaInicio: d(-250), fechaVenc: d(95), estado: 'Aprobada', version: 1 },
    // CT-07 · SURA (CP-03) + Seguros del Estado (CP-01)
    { id: 'GR-18', contractId: 'CT-07', tipo: 'Cumplimiento', aseguradora: 'Seguros Generales Suramericana (SURA)', poliza: 'PL-77450', modalidadPoliza: 'Póliza por cupo', cupoId: 'CP-03', porcentaje: 10, tomador: 'Soluciones Digitales Kairos S.A.S.', intermediario: 'SURA Brokers', prima: 2_200_000, valor: 105_900_000, fechaExp: d(-98), fechaInicio: d(-90), fechaVenc: d(240), estado: 'Aprobada', version: 1 },
    { id: 'GR-19', contractId: 'CT-07', tipo: 'Manejo de anticipo', aseguradora: 'Seguros del Estado S.A.', poliza: 'PL-43400', modalidadPoliza: 'Póliza por cupo', cupoId: 'CP-01', porcentaje: 10, tomador: 'Soluciones Digitales Kairos S.A.S.', intermediario: 'Delima Marsh S.A.', prima: 2_200_000, valor: 105_900_000, fechaExp: d(-98), fechaInicio: d(-90), fechaVenc: d(240), estado: 'Aprobada', version: 1 },
    // CT-09 · Liberty (por cupo CP-05) + Solidaria
    { id: 'GR-20', contractId: 'CT-09', tipo: 'Cumplimiento', aseguradora: 'Liberty Seguros S.A.', poliza: 'PL-20201', modalidadPoliza: 'Póliza por cupo', cupoId: 'CP-05', porcentaje: 10, tomador: 'Transportes Magdalena Express S.A.S.', intermediario: 'Liberty Brokerage', prima: 1_400_000, valor: 49_980_000, fechaExp: d(-118), fechaInicio: d(-110), fechaVenc: d(70), estado: 'Aprobada', version: 1 },
    { id: 'GR-21', contractId: 'CT-09', tipo: 'Responsabilidad civil', aseguradora: 'Aseguradora Solidaria de Colombia', poliza: 'PL-12045', modalidadPoliza: 'Póliza individual', porcentaje: 30, tomador: 'Transportes Magdalena Express S.A.S.', prima: 3_000_000, valor: 150_000_000, fechaExp: d(-118), fechaInicio: d(-110), fechaVenc: d(70), estado: 'Aprobada', version: 1 },
    // CT-10 · Seguros del Estado (CP-01) + HDI
    { id: 'GR-22', contractId: 'CT-10', tipo: 'Cumplimiento', aseguradora: 'Seguros del Estado S.A.', poliza: 'PL-43551', modalidadPoliza: 'Póliza por cupo', cupoId: 'CP-01', porcentaje: 10, tomador: 'Asesorías Jurídicas Barros & Asociados', intermediario: 'Delima Marsh S.A.', prima: 700_000, valor: 17_136_000, fechaExp: d(-86), fechaInicio: d(-80), fechaVenc: d(100), estado: 'Aprobada', version: 1 },
    { id: 'GR-23', contractId: 'CT-10', tipo: 'Responsabilidad civil', aseguradora: 'HDI Seguros', poliza: 'PL-71330', modalidadPoliza: 'Póliza individual', porcentaje: 20, tomador: 'Asesorías Jurídicas Barros & Asociados', prima: 900_000, valor: 100_000_000, fechaExp: d(-86), fechaInicio: d(-80), fechaVenc: d(100), estado: 'Aprobada', version: 1 },
  ]);

  /* ── Subcontratos (6) ───────────────────────────────────────────────── */
  await manager.getRepository(SubcontractEntity).insert([
    { id: 'SC-01', contractId: 'CT-01', numero: 'ST-01-2026', contratista: 'Clínica Norte IPS S.A.S.', nit: '901.100.201-5', objeto: 'Atención de urgencias y hospitalización en Barranquilla.', valor: 8_000_000_000, fechaInicio: d(-290), fechaFin: d(5), estado: 'Activo', ejecucion: 85, responsable: 'Martha Salcedo', version: 1 },
    { id: 'SC-02', contractId: 'CT-01', numero: 'ST-02-2026', contratista: 'Centro Médico del Caribe Ltda.', nit: '900.220.330-8', objeto: 'Consulta externa y laboratorio en Valledupar.', valor: 5_500_000_000, fechaInicio: d(-280), fechaFin: d(5), estado: 'Activo', ejecucion: 80, responsable: 'Martha Salcedo', version: 1 },
    { id: 'SC-03', contractId: 'CT-02', numero: 'ST-01-2026B', contratista: 'Drenajes del Caribe S.A.S.', nit: '901.331.442-0', objeto: 'Ejecución de drenajes pluviales de la vía lateral.', valor: 900_000_000, fechaInicio: d(-180), fechaFin: d(100), estado: 'Activo', ejecucion: 55, responsable: 'Juan Pérez', version: 1 },
    { id: 'SC-04', contractId: 'CT-06', numero: 'ST-01-2026M', contratista: 'Reparaciones Eléctricas Llanos S.A.S.', nit: '900.554.663-2', objeto: 'Mantenimiento de transformadores en Arauca y Casanare.', valor: 320_000_000, fechaInicio: d(-240), fechaFin: d(60), estado: 'Activo', ejecucion: 65, responsable: 'Martha Salcedo', version: 1 },
    { id: 'SC-05', contractId: 'CT-07', numero: 'ST-01-2026K', contratista: 'Kairos Servicios TI S.A.S.', nit: '901.664.774-4', objeto: 'Migración de datos del ERP legado.', valor: 250_000_000, fechaInicio: d(-80), fechaFin: d(180), estado: 'Activo', ejecucion: 35, responsable: 'Juan Pérez', version: 1 },
    { id: 'SC-06', contractId: 'CT-09', numero: 'ST-01-2026T', contratista: 'Flotas Magdalena S.A.S.', nit: '900.775.885-6', objeto: 'Operación de flota de apoyo para rutas del Meta.', valor: 120_000_000, fechaInicio: d(-100), fechaFin: d(50), estado: 'Activo', ejecucion: 90, responsable: 'Andrés Gómez', version: 1 },
  ]);

  /* ── Obligaciones (19) ──────────────────────────────────────────────── */
  await manager.getRepository(ObligationEntity).insert([
    { id: 'OB-01', contractId: 'CT-01', tipo: 'Reporte / informe', descripcion: 'Informe mensual de indicadores de la red', responsable: 'Néstor Villalba', fechaLimite: d(-9), periodicidad: 'Mensual', estado: 'Pendiente', cumplimiento: 0, obs: 'Demo: vencida hace 9 días.', version: 1 },
    { id: 'OB-02', contractId: 'CT-01', tipo: 'Seguridad social', descripcion: 'Aportes de seguridad social del personal', responsable: 'Néstor Villalba', fechaLimite: d(-3), periodicidad: 'Mensual', estado: 'En proceso', cumplimiento: 30, version: 1 },
    { id: 'OB-03', contractId: 'CT-01', tipo: 'Técnica', descripcion: 'Dotación de las sedes de atención primaria', responsable: 'Néstor Villalba', fechaLimite: d(-60), periodicidad: 'Única', estado: 'Cumplida', cumplimiento: 100, version: 1 },
    { id: 'OB-04', contractId: 'CT-01', tipo: 'Calidad', descripcion: 'Auditoría de calidad asistencial del segundo trimestre', responsable: 'Néstor Villalba', fechaLimite: d(12), periodicidad: 'Trimestral', estado: 'En proceso', cumplimiento: 55, version: 1 },
    { id: 'OB-05', contractId: 'CT-02', tipo: 'General', descripcion: 'Programa de gestión de seguridad y salud en la obra', responsable: 'Camilo Duarte', fechaLimite: d(-2), periodicidad: 'Permanente', estado: 'Pendiente', cumplimiento: 10, version: 1 },
    { id: 'OB-06', contractId: 'CT-02', tipo: 'Específica', descripcion: 'Reconstrucción de la capa de rodadura del tramo 1', responsable: 'Camilo Duarte', fechaLimite: d(20), periodicidad: 'Por entrega', estado: 'En proceso', cumplimiento: 60, version: 1 },
    { id: 'OB-07', contractId: 'CT-03', tipo: 'General', descripcion: 'Entrega de inventario físico de insumos del periodo', responsable: 'Elda Peralta', fechaLimite: d(-20), periodicidad: 'Mensual', estado: 'Incumplida', cumplimiento: 15, obs: 'Demo: incumplida (alerta crítica).', version: 1 },
    { id: 'OB-08', contractId: 'CT-03', tipo: 'Financiera', descripcion: 'Gestión de las facturas del último periodo', responsable: 'Elda Peralta', fechaLimite: d(-15), periodicidad: 'Mensual', estado: 'Cumplida', cumplimiento: 100, version: 1 },
    { id: 'OB-09', contractId: 'CT-04', tipo: 'Reporte / informe', descripcion: 'Informe de avance de la consultoría energética', responsable: 'Óscar Valdés', fechaLimite: d(30), periodicidad: 'Mensual', estado: 'En proceso', cumplimiento: 40, version: 1 },
    { id: 'OB-10', contractId: 'CT-05', tipo: 'Técnica', descripcion: 'Interventoría técnica del plan de expansión', responsable: 'Luisa Ferreira', fechaLimite: d(8), periodicidad: 'Mensual', estado: 'Cumplida', cumplimiento: 100, version: 1 },
    { id: 'OB-11', contractId: 'CT-06', tipo: 'Específica', descripcion: 'Mantenimiento preventivo de subestaciones del primer trimestre', responsable: 'Fabio Camargo', fechaLimite: d(-5), periodicidad: 'Trimestral', estado: 'Pendiente', cumplimiento: 20, version: 1 },
    { id: 'OB-12', contractId: 'CT-06', tipo: 'Seguridad social', descripcion: 'Aportes de seguridad social del personal técnico', responsable: 'Fabio Camargo', fechaLimite: d(25), periodicidad: 'Mensual', estado: 'En proceso', cumplimiento: 45, version: 1 },
    { id: 'OB-13', contractId: 'CT-07', tipo: 'General', descripcion: 'Diagnóstico de integraciones del ERP', responsable: 'Inés Barrios', fechaLimite: d(-4), periodicidad: 'Única', estado: 'Pendiente', cumplimiento: 5, version: 1 },
    { id: 'OB-14', contractId: 'CT-07', tipo: 'Específica', descripcion: 'Prototipo de integración con el sistema de compras', responsable: 'Inés Barrios', fechaLimite: d(15), periodicidad: 'Por entrega', estado: 'En proceso', cumplimiento: 35, version: 1 },
    { id: 'OB-15', contractId: 'CT-07', tipo: 'Legal', descripcion: 'Revisión de licenciamiento y políticas de uso', responsable: 'Inés Barrios', fechaLimite: d(-50), periodicidad: 'Única', estado: 'Cumplida', cumplimiento: 100, version: 1 },
    { id: 'OB-16', contractId: 'CT-09', tipo: 'Reporte / informe', descripcion: 'Informe mensual de rutas y kilzometraje', responsable: 'Marta Ibáñez', fechaLimite: d(10), periodicidad: 'Mensual', estado: 'En proceso', cumplimiento: 50, version: 1 },
    { id: 'OB-17', contractId: 'CT-09', tipo: 'Seguridad social', descripcion: 'Planillas de seguridad social de conductores', responsable: 'Marta Ibáñez', fechaLimite: d(-40), periodicidad: 'Mensual', estado: 'Cumplida', cumplimiento: 100, version: 1 },
    { id: 'OB-18', contractId: 'CT-10', tipo: 'Legal', descripcion: 'Concepto jurídico del pliego del proceso 108', responsable: 'Tulio Barros', fechaLimite: d(2), periodicidad: 'Por entrega', estado: 'En proceso', cumplimiento: 70, version: 1 },
    { id: 'OB-19', contractId: 'CT-10', tipo: 'General', descripcion: 'Revisión del reglamento interno de contratación', responsable: 'Tulio Barros', fechaLimite: d(-60), periodicidad: 'Única', estado: 'Cumplida', cumplimiento: 100, version: 1 },
  ]);

  /* ── Entregables (13) ───────────────────────────────────────────────── */
  await manager.getRepository(DeliverableEntity).insert([
    { id: 'EN-01', contractId: 'CT-02', nombre: 'Diseño de drenajes', descripcion: 'Plano y memoria de cálculo del tramo 1.', fechaInicio: d(-180), fechaProg: d(-120), fechaReal: d(-118), responsable: 'Camilo Duarte', estado: 'Aprobado', avance: 100, version: 1 },
    { id: 'EN-02', contractId: 'CT-02', nombre: 'Prueba de drenajes', fechaInicio: d(-90), fechaProg: d(80), responsable: 'Camilo Duarte', estado: 'Pendiente', avance: 20, version: 1 },
    { id: 'EN-03', contractId: 'CT-03', nombre: 'Informe de suministro del mes', fechaInicio: d(-40), fechaProg: d(-15), fechaReal: d(-16), responsable: 'Elda Peralta', estado: 'Entregado', avance: 100, version: 1 },
    { id: 'EN-04', contractId: 'CT-05', nombre: 'Informe mensual de interventoría', fechaInicio: d(-60), fechaProg: d(-10), fechaReal: d(-11), responsable: 'Luisa Ferreira', estado: 'Aprobado', avance: 100, version: 1 },
    { id: 'EN-05', contractId: 'CT-05', nombre: 'Revisión contable de la expansión', fechaInicio: d(-30), fechaProg: d(12), responsable: 'Luisa Ferreira', estado: 'En proceso', avance: 55, version: 1 },
    { id: 'EN-06', contractId: 'CT-06', nombre: 'Plan de mantenimiento anual', fechaInicio: d(-240), fechaProg: d(-30), fechaReal: d(-31), responsable: 'Fabio Camargo', estado: 'Aprobado', avance: 100, version: 1 },
    { id: 'EN-07', contractId: 'CT-06', nombre: 'Bitácora de equipos', fechaInicio: d(-120), fechaProg: d(40), responsable: 'Fabio Camargo', estado: 'En proceso', avance: 60, version: 1 },
    { id: 'EN-08', contractId: 'CT-07', nombre: 'Diagnóstico del ERP', fechaInicio: d(-85), fechaProg: d(-60), fechaReal: d(-59), responsable: 'Inés Barrios', estado: 'Aprobado', avance: 100, version: 1 },
    { id: 'EN-09', contractId: 'CT-07', nombre: 'Prototipo de integración', fechaInicio: d(-60), fechaProg: d(-5), fechaReal: d(-4), responsable: 'Inés Barrios', estado: 'Entregado', avance: 100, version: 1 },
    { id: 'EN-10', contractId: 'CT-07', nombre: 'Migración de datos', fechaInicio: d(-20), fechaProg: d(60), responsable: 'Inés Barrios', estado: 'Pendiente', avance: 10, version: 1 },
    { id: 'EN-11', contractId: 'CT-07', nombre: 'Capacitación de usuarios', fechaInicio: d(30), fechaProg: d(90), responsable: 'Inés Barrios', estado: 'Pendiente', avance: 0, version: 1 },
    { id: 'EN-12', contractId: 'CT-07', nombre: 'Informe de pruebas de rendimiento', fechaInicio: d(-45), fechaProg: d(-2), responsable: 'Inés Barrios', estado: 'Pendiente', avance: 25, obs: 'Demo: entregable vencido (alerta de riesgo).', version: 1 },
    { id: 'EN-13', contractId: 'CT-09', nombre: 'Plan de rutas optimizado', fechaInicio: d(-100), fechaProg: d(-40), fechaReal: d(-41), responsable: 'Marta Ibáñez', estado: 'Aprobado', avance: 100, version: 1 },
  ]);

  /* ── Actas (18) ─────────────────────────────────────────────────────── */
  const actasRepo = manager.getRepository(ActaEntity);
  const actas: [string, string, string, number, string, string, string][] = [
    ['AC-01', 'CT-01', 'Acta de inicio', -294, 'Inicio de la operación de la red de salud.', 'Firmada', 'Néstor Villalba'],
    ['AC-02', 'CT-01', 'Acta parcial', -150, 'Entrega parcial del primer trimestre de la red.', 'Firmada', 'Néstor Villalba'],
    ['AC-03', 'CT-01', 'Acta parcial', -20, 'Entrega parcial del segundo trimestre de la red.', 'Borrador acta', 'Néstor Villalba'],
    ['AC-04', 'CT-02', 'Acta de inicio', -190, 'Inicio de la obra de rehabilitación vial.', 'Firmada', 'Camilo Duarte'],
    ['AC-05', 'CT-02', 'Acta parcial', -60, 'Recepción parcial del tramo 1.', 'Firmada', 'Camilo Duarte'],
    ['AC-06', 'CT-03', 'Acta de inicio', -310, 'Inicio del suministro de insumos.', 'Firmada', 'Elda Peralta'],
    ['AC-07', 'CT-03', 'Acta de terminación', -10, 'Cierre del suministro sin prórroga.', 'Firmada', 'Elda Peralta'],
    ['AC-08', 'CT-04', 'Acta de inicio', -140, 'Inicio de la consultoría energética.', 'Firmada', 'Óscar Valdés'],
    ['AC-09', 'CT-05', 'Acta de inicio', -370, 'Inicio de la interventoría.', 'Firmada', 'Luisa Ferreira'],
    ['AC-10', 'CT-05', 'Acta parcial', -120, 'Recepción parcial de informes.', 'Firmada', 'Luisa Ferreira'],
    ['AC-11', 'CT-06', 'Acta de inicio', -250, 'Inicio del mantenimiento industrial.', 'Firmada', 'Fabio Camargo'],
    ['AC-12', 'CT-06', 'Acta parcial', -60, 'Recepción parcial del plan anual.', 'Firmada', 'Fabio Camargo'],
    ['AC-13', 'CT-07', 'Acta de inicio', -90, 'Inicio de la modernización del ERP.', 'Firmada', 'Inés Barrios'],
    ['AC-14', 'CT-07', 'Acta parcial', -30, 'Recepción del diagnóstico.', 'Firmada', 'Inés Barrios'],
    ['AC-15', 'CT-08', 'Acta de inicio', -490, 'Inicio del arrendamiento de bodegas.', 'Firmada', 'Hernán Suárez'],
    ['AC-16', 'CT-08', 'Acta parcial', -250, 'Recepción parcial de las bodegas.', 'Firmada', 'Hernán Suárez'],
    ['AC-17', 'CT-08', 'Acta de liquidación', -78, 'Liquidación del contrato de arrendamiento.', 'Firmada', 'Hernán Suárez'],
    ['AC-18', 'CT-09', 'Acta de inicio', -110, 'Inicio del transporte de carga.', 'Firmada', 'Marta Ibáñez'],
  ];
  for (const [id, contractId, tipo, off, descripcion, estado, responsable] of actas) {
    await actasRepo.insert(actasRepo.create({
      id, contractId, numero: id.replace('AC-', 'A-'), tipo, fecha: d(off), descripcion, estado, responsable,
      valor: null, version: 1,
    }));
  }

  /* ── Modificaciones (4) ─────────────────────────────────────────────── */
  await manager.getRepository(ModificationEntity).insert([
    { id: 'MD-01', contractId: 'CT-02', numero: 'MD-01', tipo: 'Adición', fecha: d(-120), justificacion: 'Adición de obra para obras complementarias de señalización.', valorAnterior: 3_800_000_000, valorNuevo: 3_811_500_000, impacto: 'Aumenta el valor del contrato en 11,5 millones. Revise las pólizas.', estado: 'Activa', version: 1 },
    { id: 'MD-02', contractId: 'CT-04', numero: 'MD-02', tipo: 'Suspensión', fecha: d(-30), justificacion: 'Suspensión de actividades por reorganización del área.', impacto: 'El contrato queda suspendido.', estado: 'Activa', version: 1 },
    { id: 'MD-03', contractId: 'CT-05', numero: 'MD-03', tipo: 'Prórroga', fecha: d(-45), justificacion: 'Prórroga para cerrar el plan de expansión.', fechaAnterior: d(-22), fechaNueva: d(8), impacto: 'Se amplía la terminación. Revise las pólizas.', estado: 'Activa', version: 1 },
    { id: 'MD-04', contractId: 'CT-09', numero: 'MD-04', tipo: 'Adición', fecha: d(-60), justificacion: 'Adición por nuevas rutas del Meta.', valorAnterior: 460_000_000, valorNuevo: 499_800_000, impacto: 'Aumenta el valor del contrato. Revise las pólizas.', estado: 'Activa', version: 1 },
  ]);

  /* ── Riesgos (10) ───────────────────────────────────────────────────── */
  await manager.getRepository(RiskEntity).insert([
    { id: 'RG-01', contractId: 'CT-01', categoria: 'Operativo', riesgo: 'Capacidad hospitalaria insuficiente en temporada alta', prob: 4, impacto: 4, responsable: 'Martha Salcedo', tratamiento: 'Mitigar', fecha: d(-280), estado: 'Abierto', mitigacion: null, version: 1 },
    { id: 'RG-02', contractId: 'CT-01', categoria: 'Financiero', riesgo: 'Giro de recursos por debajo del gasto real', prob: 3, impacto: 3, responsable: 'Andrés Gómez', tratamiento: 'Mitigar', fecha: d(-270), estado: 'Controlado', mitigacion: 'Tabla de giros semanal con corte de ejecución.', version: 1 },
    { id: 'RG-03', contractId: 'CT-02', categoria: 'Legal / regulatorio', riesgo: 'Cambio de normativa vial durante la obra', prob: 2, impacto: 4, responsable: 'Juan Pérez', tratamiento: 'Transferir', fecha: d(-180), estado: 'Controlado', mitigacion: 'Póliza de estabilidad en trámite.', version: 1 },
    { id: 'RG-04', contractId: 'CT-02', categoria: 'Operativo', riesgo: 'Retraso en la entrega de materiales', prob: 3, impacto: 3, responsable: 'Camilo Duarte', tratamiento: 'Mitigar', fecha: d(-170), estado: 'Controlado', mitigacion: 'Plan de compras anticipadas.', version: 1 },
    { id: 'RG-05', contractId: 'CT-03', categoria: 'Cumplimiento', riesgo: 'Desabastecimiento de insumos por fallas del proveedor', prob: 4, impacto: 4, responsable: 'Andrés Gómez', tratamiento: 'Aceptar', fecha: d(-300), estado: 'Abierto', mitigacion: null, version: 1 },
    { id: 'RG-06', contractId: 'CT-04', categoria: 'Técnico', riesgo: 'Pérdida de acceso a los datos de consumo', prob: 2, impacto: 3, responsable: 'Juan Pérez', tratamiento: 'Mitigar', fecha: d(-140), estado: 'Controlado', mitigacion: 'Respaldo mensual de fuentes.', version: 1 },
    { id: 'RG-07', contractId: 'CT-06', categoria: 'Proveedor', riesgo: 'Escasez de repuestos para transformadores', prob: 3, impacto: 2, responsable: 'Martha Salcedo', tratamiento: 'Mitigar', fecha: d(-240), estado: 'Controlado', mitigacion: 'Convenio con dos proveedores.', version: 1 },
    { id: 'RG-08', contractId: 'CT-07', categoria: 'Técnico', riesgo: 'Incompatibilidad del ERP legado con la migración', prob: 3, impacto: 4, responsable: 'Juan Pérez', tratamiento: 'Mitigar', fecha: d(-85), estado: 'Abierto', mitigacion: 'Piloto de migración por lotes.', version: 1 },
    { id: 'RG-09', contractId: 'CT-09', categoria: 'Operativo', riesgo: 'Averías en la flota en rutas largas', prob: 3, impacto: 3, responsable: 'Andrés Gómez', tratamiento: 'Transferir', fecha: d(-105), estado: 'Controlado', mitigacion: 'Seguro de flota y mantenimiento.', version: 1 },
    { id: 'RG-10', contractId: 'CT-09', categoria: 'Financiero', riesgo: 'Sobreejecución por tarifas de combustible', prob: 4, impacto: 4, responsable: 'Andrés Gómez', tratamiento: 'Mitigar', fecha: d(-100), estado: 'Abierto', mitigacion: null, version: 1 },
  ]);

  /* ── Incumplimientos (4) ────────────────────────────────────────────── */
  await manager.getRepository(BreachEntity).insert([
    { id: 'IN-01', contractId: 'CT-01', fecha: d(-7), obligationId: 'OB-01', tipo: 'Reporte sin presentar', descripcion: 'No se presentó el informe mensual de indicadores correspondiente.', responsable: 'Martha Salcedo', impacto: 'Alto', estado: 'Abierto', plan: 'Requerimiento formal y plan de mejoramiento.', fechaLimite: d(7), multa: 0, version: 1 },
    { id: 'IN-02', contractId: 'CT-03', fecha: d(-18), obligationId: 'OB-07', tipo: 'Falla de suministro', descripcion: 'Incompletitud de la entrega de insumos del periodo.', responsable: 'Elda Peralta', impacto: 'Medio', estado: 'En gestión', plan: 'Suministro complementario en 15 días.', fechaLimite: d(-3), version: 1 },
    { id: 'IN-03', contractId: 'CT-04', fecha: d(-35), tipo: 'Retraso de entregables', descripcion: 'Entrega tardía del informe de avance de la consultoría.', responsable: 'Juan Pérez', impacto: 'Bajo', estado: 'Subsanado', medida: 'Entrega subsanada con recargo.', multa: 0, version: 1 },
    { id: 'IN-04', contractId: 'CT-09', fecha: d(-25), tipo: 'Sobreconsumo', descripcion: 'La ejecución financiera supera el valor contratado sin adición soportada.', responsable: 'Andrés Gómez', impacto: 'Medio', estado: 'Abierto', plan: 'Registrar adición formal del contrato.', fechaLimite: d(5), version: 1 },
  ]);

  /* ── Planes de mejoramiento (3) ─────────────────────────────────────── */
  await manager.getRepository(PlanEntity).insert([
    { id: 'PM-01', contractId: 'CT-01', fecha: d(-5), hallazgo: 'Informe mensual no presentado (OB-01).', causa: 'Falla de coordinación del área de reportes.', accion: 'Requerimiento formal y cronograma de reportes.', responsable: 'Martha Salcedo', estado: 'En ejecución', avance: 45, version: 1 },
    { id: 'PM-02', contractId: 'CT-03', fecha: d(-15), hallazgo: 'Entrega incompleta de insumos (OB-07).', causa: 'Demoras del proveedor de insumos.', accion: 'Suministro complementario en 15 días.', responsable: 'Andrés Gómez', estado: 'Abierto', avance: 20, version: 1 },
    { id: 'PM-03', contractId: 'CT-09', fecha: d(-20), hallazgo: 'Ejecución financiera por encima del valor contratado.', causa: 'Falta de adición formal por nuevas rutas.', accion: 'Registrar adición y revisar pólizas.', responsable: 'Andrés Gómez', estado: 'En ejecución', avance: 60, version: 1 },
  ]);

  /* ── Documentos (42) ────────────────────────────────────────────────── */
  const docsRepo = manager.getRepository(DocumentEntity);
  const versRepo = manager.getRepository(DocumentVersionEntity);
  const docs: [string, string, string, number, string | null, boolean][] = [
    // [id, contractId, categoria, offset, obs, conExtracted]
    ['DOC-01', 'CT-01', 'Contrato', -296, null, true],
    ['DOC-02', 'CT-01', 'Estudios previos', -310, 'Estudio de necesidades de la red.', false],
    ['DOC-03', 'CT-01', 'Propuesta', -297, null, false],
    ['DOC-04', 'CT-01', 'Garantías', -295, 'Pólizas por cupo expedidas.', false],
    ['DOC-05', 'CT-01', 'Actas', -290, 'Actas escaneadas.', false],
    ['DOC-06', 'CT-01', 'Informes', -20, 'Informes mensuales.', false],
    ['DOC-07', 'CT-02', 'Contrato', -198, null, true],
    ['DOC-08', 'CT-02', 'Propuesta', -199, null, false],
    ['DOC-09', 'CT-02', 'Garantías', -195, 'Incluye póliza por cupo.', false],
    ['DOC-10', 'CT-02', 'Actas', -180, null, false],
    ['DOC-11', 'CT-02', 'Evidencias', -90, 'Registro fotográfico.', false],
    ['DOC-12', 'CT-03', 'Contrato', -318, null, false],
    ['DOC-13', 'CT-03', 'Propuesta', -319, null, false],
    ['DOC-14', 'CT-03', 'Garantías', -315, 'Póliza de cumplimiento vencida.', false],
    ['DOC-15', 'CT-03', 'Actas', -300, null, false],
    ['DOC-16', 'CT-04', 'Contrato', -148, null, false],
    ['DOC-17', 'CT-04', 'Propuesta', -149, null, false],
    ['DOC-18', 'CT-04', 'Garantías', -145, null, false],
    ['DOC-19', 'CT-04', 'Actas', -130, null, false],
    ['DOC-20', 'CT-05', 'Contrato', -378, null, false],
    ['DOC-21', 'CT-05', 'Propuesta', -379, null, false],
    ['DOC-22', 'CT-05', 'Actas', -350, null, false],
    ['DOC-23', 'CT-06', 'Contrato', -258, null, false],
    ['DOC-24', 'CT-06', 'Propuesta', -259, null, false],
    ['DOC-25', 'CT-06', 'Garantías', -255, null, false],
    ['DOC-26', 'CT-06', 'Actas', -240, null, false],
    ['DOC-27', 'CT-07', 'Contrato', -98, null, false],
    ['DOC-28', 'CT-07', 'Propuesta', -99, null, false],
    ['DOC-29', 'CT-07', 'Garantías', -95, null, false],
    ['DOC-30', 'CT-07', 'Actas', -80, null, false],
    ['DOC-31', 'CT-08', 'Contrato', -498, null, false],
    ['DOC-32', 'CT-08', 'Propuesta', -499, null, false],
    ['DOC-33', 'CT-08', 'Garantías', -495, null, false],
    ['DOC-34', 'CT-08', 'Actas', -90, 'Incluye acta de liquidación.', false],
    ['DOC-35', 'CT-09', 'Contrato', -118, null, false],
    ['DOC-36', 'CT-09', 'Propuesta', -119, null, false],
    ['DOC-37', 'CT-09', 'Garantías', -115, null, false],
    ['DOC-38', 'CT-09', 'Facturas', -50, 'Facturas del transporte.', false],
    ['DOC-39', 'CT-10', 'Contrato', -86, null, false],
    ['DOC-40', 'CT-10', 'Propuesta', -87, null, false],
    ['DOC-41', 'CT-10', 'Garantías', -85, null, false],
    ['DOC-42', 'CT-10', 'Actas', -70, null, false],
  ];
  for (const [id, contractId, categoria, off, obs, conExtracted] of docs) {
    let extracted: Record<string, unknown> | null = null;
    if (conExtracted && id === 'DOC-01') {
      const c = CONFIG[0];
      extracted = {
        valor: valorInicialDe(c), fechaInicio: d(c.inicio), fechaFin: d(c.fin),
        plazoDias: 300, objeto: c.objeto, contratista: c.contratista, nit: c.nit, garantias: ['Cumplimiento', 'Manejo de anticipo', 'Calidad', 'Responsabilidad civil'], origen: 'manual',
      };
    }
    if (conExtracted && id === 'DOC-07') {
      // Demo de conciliación con diferencias (files/05 §5).
      const c = CONFIG[1];
      extracted = {
        valor: valorInicialDe(c) - 100_000_000, fechaInicio: d(c.inicio), fechaFin: d(c.fin),
        plazoDias: 310, objeto: `${c.objeto} (documentado)`, contratista: c.contratista.toUpperCase(), nit: c.nit, garantias: ['Cumplimiento'], origen: 'manual',
      };
    }
    await docsRepo.insert(docsRepo.create({
      id, contractId, nombre: `${categoria}-${id}.pdf`, categoria, estado: 'Activo',
      obs, extracted, version: 1,
    }));
    await versRepo.insert(versRepo.create({
      id: `DV-${id.slice(4)}-1`, documentId: id, v: 1, fecha: d(off), usuario: 'Laura Méndez',
      archivo: `archivo-${id}.pdf`, motivo: 'Carga inicial', cambios: null,
    }));
  }
  // Segunda versión del contrato CT-01 (las versiones nunca se borran).
  await versRepo.insert(versRepo.create({
    id: 'DV-01-2', documentId: 'DOC-01', v: 2, fecha: d(-90), usuario: 'Juan Pérez',
    archivo: 'archivo-DOC-01-v2.pdf', motivo: 'Actualización de anexos', cambios: 'Se corrige la cláusula de duración.',
  }));

  /* ── Auditoría demo (18) ────────────────────────────────────────────── */
  const auditRepo = manager.getRepository(AuditLogEntity);
  const demoAudit: [number, string, string, string, string, string | null, string | null, string | null, string | null, string][] = [
    // [offsetDías, usuario, rol, modulo, accion, campo, anterior, nuevo, obs, ip]
    [-200, 'Laura Méndez', 'ADMINISTRADOR', 'Empresas', 'CREAR', null, null, 'Salud Integral del Caribe IPS S.A.S.', null, '192.168.1.10'],
    [-199, 'Laura Méndez', 'ADMINISTRADOR', 'Empresas', 'CREAR', null, null, 'Grupo Andino de Infraestructura S.A.S.', null, '192.168.1.10'],
    [-198, 'Juan Pérez', 'CONTRATACIÓN', 'Contratos', 'CREAR', null, null, '051-2026 (Constructora Barlovento S.A.S.)', null, '192.168.1.14'],
    [-196, 'Laura Méndez', 'ADMINISTRADOR', 'Contratos', 'CREAR', null, null, '044-2026 (Unión Temporal Red Salud Norte)', null, '192.168.1.10'],
    [-195, 'Laura Méndez', 'ADMINISTRADOR', 'Garantías', 'CREAR', null, null, 'Cumplimiento PL-431371 (Seguros del Estado S.A.)', null, '192.168.1.10'],
    [-150, 'Juan Pérez', 'CONTRATACIÓN', 'Modificaciones', 'CREAR', null, null, 'MD-01 (Adición)', null, '192.168.1.14'],
    [-90, 'Juan Pérez', 'CONTRATACIÓN', 'Documentos', 'VERSION', 'v', '1', '2', 'Actualización de anexos del contrato', '192.168.1.14'],
    [-60, 'Andrés Gómez', 'FINANCIERA', 'Modificaciones', 'CREAR', null, null, 'MD-04 (Adición)', null, '192.168.1.18'],
    [-45, 'Ricardo Ortiz', 'INTERVENTOR', 'Contratos', 'EDITAR', 'avanceFisico', '40', '82', 'Actualización del avance físico', '192.168.1.16'],
    [-30, 'Ricardo Ortiz', 'INTERVENTOR', 'Modificaciones', 'CREAR', null, null, 'MD-02 (Suspensión)', null, '192.168.1.16'],
    [-30, 'Martha Salcedo', 'SUPERVISOR', 'Ejecución', 'CREAR', null, null, 'EX-01-04', null, '192.168.1.20'],
    [-25, 'Andrés Gómez', 'FINANCIERA', 'Pagos', 'APROBAR', 'estado', 'En revisión', 'Aprobado', null, '192.168.1.18'],
    [-20, 'Laura Méndez', 'ADMINISTRADOR', 'Sistema', 'PARAMETRO', 'budgetPct', '20', '15', null, '192.168.1.10'],
    [-15, 'Carolina Ríos', 'JURÍDICA', 'Incumplimientos', 'CREAR', null, null, 'IN-01 (Reporte sin presentar)', null, '192.168.1.22'],
    [-10, 'Juan Pérez', 'CONTRATACIÓN', 'Contratos', 'EDITAR', 'descripcion', null, 'Se anexa cláusula de cobertura regional.', null, '192.168.1.14'],
    [-7, 'Martha Salcedo', 'SUPERVISOR', 'Contratos', 'EDITAR', 'avanceFisico', '70', '88', null, '192.168.1.20'],
    [-3, 'Juan Pérez', 'CONTRATACIÓN', 'Sistema', 'LOGIN', null, null, 'Juan Pérez (CONTRATACIÓN)', null, '192.168.1.14'],
    [-2, 'Laura Méndez', 'ADMINISTRADOR', 'Sistema', 'LOGIN', null, null, 'Laura Méndez (ADMINISTRADOR)', null, '192.168.1.10'],
  ];
  let prevHash = '';
  for (const [off, usuario, rol, modulo, accion, campo, anterior, nuevo, obs, ip] of demoAudit) {
    const fecha = sumarDias(hoy, off);
    const hora = '09:30:00';
    const payload = [fecha, hora, usuario, rol, modulo, accion, campo ?? '', anterior ?? '', nuevo ?? '', obs ?? ''].join('|');
    const hash = createHash('sha256').update(`${payload}|${prevHash}`).digest('hex');
    prevHash = hash;
    await auditRepo.insert(auditRepo.create({
      ts: new Date(`${fecha}T09:30:00Z`), fecha, hora, usuario, rol, contractId: null,
      modulo, accion, campo, anterior, nuevo, ip, obs, hash,
    }));
  }

  /* ── Verificación de volumen (files/11) ─────────────────────────────── */
  const conteo = async (tabla: string): Promise<number> => Number(
    (await manager.query(`SELECT COUNT(*)::int AS c FROM ${tabla}`))[0]?.c ?? 0,
  );
  const resumen = {
    companies: await conteo('companies'),
    contracts: await conteo('contracts'),
    subcontracts: await conteo('subcontracts'),
    obligations: await conteo('obligations'),
    deliverables: await conteo('deliverables'),
    execs: await conteo('execs'),
    payments: await conteo('payments'),
    guarantees: await conteo('guarantees'),
    actas: await conteo('actas'),
    modifications: await conteo('modifications'),
    risks: await conteo('risks'),
    breaches: await conteo('breaches'),
    plans: await conteo('plans'),
    documents: await conteo('documents'),
    audit: await conteo('audit_log'),
    users: await conteo('users'),
    cupos: await conteo('cupos'),
    tareas: await conteo('tasks'),
  };
  console.log('Seed demo completado:', resumen);
}

/* Tipos auxiliares del seed */
type PermisoEstado = string[];

function valorInicialDe(cfg: ConfigContrato): number {
  return cfg.valorActual - (cfg.adiciones ?? 0);
}

/** Lista de N periodos AAAA-MM consecutivos desde la fecha de inicio. */
function periodoDesde(fechaISO: string, n: number): string[] {
  const out: string[] = [];
  const base = new Date(`${fechaISO}T00:00:00Z`);
  // Evita saltar febrero y repetir marzo cuando la fecha inicial cae en día 29, 30 o 31.
  base.setUTCDate(1);
  for (let i = 0; i < n; i++) {
    const dt = new Date(base);
    dt.setUTCMonth(dt.getUTCMonth() + i);
    out.push(dt.toISOString().slice(0, 7));
  }
  return out;
}
