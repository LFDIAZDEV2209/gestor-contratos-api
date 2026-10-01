import { diffDias, redondear1, sumarDias } from '../common/dates';
import { DOCS_REQUERIDOS, ESTADOS_CERRADOS, ContractBase, ContractCtx } from './types';

export interface Metricas {
  valorInicial: number;
  valorActual: number;
  ejecutado: number;
  pagado: number;
  saldo: number;
  pctFin: number;
  pctFis: number;
  pctSaldo: number;
  duracionDias: number;
  duracionMeses: number;
  diasTranscurridos: number;
  restantes: number;
  pctTiempo: number;
  promedioMensual: number | null;
  fechaAgotamiento: string | null;
  seAgotaAntesDelPlazo: boolean;
  estadoEfectivo: string;
  estadoTemporal: 'Sin fechas' | 'Por iniciar' | 'Plazo cumplido' | 'Próximo a vencer' | 'En plazo';
  contratoCerrado: boolean;
}

const n = (v: number | null | undefined): number => v ?? 0;

/** Valor actualizado a partir de los campos de valores del contrato (formula de files/05). */
export function valorActualDe(
  valorBase: number | null | undefined, iva: number | null | undefined, otrosImp: number | null | undefined,
  adiciones: number | null | undefined, reducciones: number | null | undefined,
): number {
  return Math.round(n(valorBase) + n(iva) + n(otrosImp) + n(adiciones) - n(reducciones));
}

/** M(c): métricas del contrato con las fórmulas exactas de files/05. */
export function calcularMetricas(
  c: ContractBase,
  ctx: Pick<ContractCtx, 'execs' | 'payments'>,
  hoy: string,
): Metricas {
  const valorInicial = Math.round(n(c.valorBase) + n(c.iva) + n(c.otrosImp));
  const valorActual = Math.round(valorInicial + n(c.adiciones) - n(c.reducciones));
  const ejecutado = Math.round(ctx.execs.filter((e) => !e.anulado).reduce((s, e) => s + e.valor, 0));
  const pagado = Math.round(
    ctx.payments
      .filter((p) => !p.anulado && p.estado === 'Pagado')
      .reduce((s, p) => s + p.bruto + n(p.iva), 0),
  );
  const saldo = valorActual - ejecutado;
  const pctFin = valorActual > 0 ? redondear1((ejecutado / valorActual) * 100) : 0;
  const pctFis = redondear1(n(c.avanceFisico));
  const pctSaldo = valorActual > 0 ? redondear1((saldo / valorActual) * 100) : 0;

  const tieneFechas = !!c.fechaInicio && !!c.fechaFin;
  const duracionDias = tieneFechas ? diffDias(c.fechaInicio as string, c.fechaFin as string) + 1 : 0;
  const duracionMeses = duracionDias > 0 ? redondear1(duracionDias / 30.4) : 0;
  const diasTranscurridos = tieneFechas
    ? Math.min(duracionDias, Math.max(0, diffDias(c.fechaInicio as string, hoy) + 1))
    : 0;
  const restantes = tieneFechas ? diffDias(hoy, c.fechaFin as string) : 0;
  const pctTiempo = duracionDias > 0 ? redondear1((diasTranscurridos / duracionDias) * 100) : 0;

  const promedioMensual = promedioUltimos3(ctx.execs);
  const fechaAgotamiento = fechaDeAgotamiento(saldo, promedioMensual, hoy);
  const seAgotaAntesDelPlazo =
    tieneFechas && c.estado === 'Activo' && !!fechaAgotamiento && fechaAgotamiento < (c.fechaFin as string);

  return {
    valorInicial,
    valorActual,
    ejecutado,
    pagado,
    saldo,
    pctFin,
    pctFis,
    pctSaldo,
    duracionDias,
    duracionMeses,
    diasTranscurridos,
    restantes,
    pctTiempo,
    promedioMensual,
    fechaAgotamiento,
    seAgotaAntesDelPlazo,
    estadoEfectivo: estadoEfectivo(c, hoy),
    estadoTemporal: estadoTemporal(c, hoy),
    contratoCerrado: ESTADOS_CERRADOS.includes(c.estado),
  };
}

/** Estado efectivo: Activo con fechaFin pasada ⇒ Vencido; anulado ⇒ Anulado; si no, el registrado. */
export function estadoEfectivo(c: ContractBase, hoy: string): string {
  if (c.anulado) return 'Anulado';
  if (c.estado === 'Activo' && c.fechaFin && diffDias(hoy, c.fechaFin) < 0) return 'Vencido';
  return c.estado;
}

/** Estado temporal: Sin fechas / Por iniciar / Plazo cumplido / Próximo a vencer (≤30 días) / En plazo. */
export function estadoTemporal(
  c: ContractBase,
  hoy: string,
): Metricas['estadoTemporal'] {
  if (!c.fechaInicio || !c.fechaFin) return 'Sin fechas';
  if (diffDias(hoy, c.fechaInicio) > 0) return 'Por iniciar';
  if (diffDias(hoy, c.fechaFin) < 0) return 'Plazo cumplido';
  if (diffDias(hoy, c.fechaFin) <= 30) return 'Próximo a vencer';
  return 'En plazo';
}

/** Promedio del valor ejecutado en los últimos 3 periodos registrados. */
export function promedioUltimos3(execs: { periodo: string; valor: number; anulado?: boolean }[]): number | null {
  const vivos = execs.filter((e) => !e.anulado);
  if (!vivos.length) return null;
  const ultimos = [...vivos].sort((a, b) => (a.periodo < b.periodo ? -1 : 1)).slice(-3);
  return Math.round(ultimos.reduce((s, e) => s + e.valor, 0) / ultimos.length);
}

/** Hoy + (saldo ÷ promedio mensual) × 30,4 días. Saldo ≤ 0 ⇒ hoy. */
export function fechaDeAgotamiento(saldo: number, promedioMensual: number | null, hoy: string): string | null {
  if (!promedioMensual || promedioMensual <= 0) return null;
  if (saldo <= 0) return hoy;
  return sumarDias(hoy, Math.round((saldo / promedioMensual) * 30.4));
}

/** Índice interno de control 0–100 (no califica al contratista). */
export function calcularControlScore(
  c: ContractBase,
  ctx: Omit<ContractCtx, 'contract'>,
  m: Metricas,
  hoy: string,
): { score: number; nivel: 'verde' | 'amarillo' | 'rojo' } {
  // Documentación 20 %
  const categorias = new Set(
    ctx.documents.filter((d) => !d.anulado && d.estado !== 'Anulado').map((d) => d.categoria),
  );
  const presentes = DOCS_REQUERIDOS.filter((r) => categorias.has(r)).length;
  const docScore = DOCS_REQUERIDOS.length ? (presentes / DOCS_REQUERIDOS.length) * 100 : 100;

  // Obligaciones 20 % (50 si no hay ninguna)
  const oblig = ctx.obligations.filter((o) => !o.anulado);
  const obligMal = oblig.filter((o) => obligacionVencida(o, hoy) || o.estado === 'Incumplida').length;
  const obligScore = oblig.length ? ((oblig.length - obligMal) / oblig.length) * 100 : 50;

  // Ejecución 15 % (brecha, máximo 60 de descuento; 40 si >100 %; 30 si no hay registros)
  const hayExecs = ctx.execs.some((e) => !e.anulado);
  let ejecScore: number;
  if (!hayExecs) ejecScore = 30;
  else if (m.pctFin > 100) ejecScore = 40;
  else ejecScore = Math.max(40, 100 - Math.abs(m.pctFin - m.pctFis));

  // Garantías 15 % (0 si no hay)
  const gar = ctx.guarantees.filter((g) => !g.anulado);
  const garVencidas = gar.filter(
    (g) => g.estado === 'Aprobada' && g.fechaVenc && diffDias(hoy, g.fechaVenc) < 0,
  ).length;
  const garScore = gar.length ? ((gar.length - garVencidas) / gar.length) * 100 : 0;

  // Pagos 10 % (60 si no hay)
  const pag = ctx.payments.filter((p) => !p.anulado);
  const pagScore = pag.length ? (pag.filter((p) => !!p.soporte).length / pag.length) * 100 : 60;

  // Riesgos 10 % (40 si no hay)
  const ris = ctx.risks.filter((r) => !r.anulado);
  const risScore = ris.length ? (ris.filter((r) => !!r.mitigacion).length / ris.length) * 100 : 40;

  // Auditoría 10 %
  const audScore = ctx.auditCount >= 2 ? 100 : 60;

  const score = Math.round(
    docScore * 0.2 + obligScore * 0.2 + ejecScore * 0.15 + garScore * 0.15 +
    pagScore * 0.1 + risScore * 0.1 + audScore * 0.1,
  );
  return { score, nivel: score >= 85 ? 'verde' : score >= 65 ? 'amarillo' : 'rojo' };
}

/** Obligación vencida: Pendiente o En proceso y su fecha límite ya pasó. */
export function obligacionVencida(
  o: { estado?: string; fechaLimite?: string | null; anulado?: boolean },
  hoy: string,
): boolean {
  if (o.anulado) return false;
  if (o.estado !== 'Pendiente' && o.estado !== 'En proceso') return false;
  return !!o.fechaLimite && diffDias(hoy, o.fechaLimite) < 0;
}

/** Entregable vencido: no aprobado/entregado/suspendido, sin fecha real y con fecha programada pasada. */
export function entregableVencido(
  d: { estado?: string; fechaProg?: string | null; fechaReal?: string | null; anulado?: boolean },
  hoy: string,
): boolean {
  if (d.anulado) return false;
  if (['Aprobado', 'Entregado', 'Suspendido'].includes(d.estado ?? '')) return false;
  if (d.fechaReal) return false;
  return !!d.fechaProg && diffDias(hoy, d.fechaProg) < 0;
}

/** Categorías de documentos requeridos que faltan. */
export function docsFaltantes(documents: { categoria: string; estado?: string; anulado?: boolean }[]): string[] {
  const presentes = new Set(
    documents.filter((d) => !d.anulado && d.estado !== 'Anulado').map((d) => d.categoria),
  );
  return DOCS_REQUERIDOS.filter((r) => !presentes.has(r));
}
