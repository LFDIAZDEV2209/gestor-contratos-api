import { diffDias, redondear1 } from '../common/dates';
import {
  ESTADOS_CERRADOS,
  ContractBase,
  ContractCtx,
  nivelRiesgo,
  ParametrosAlerta,
} from './types';
import {
  entregableVencido,
  obligacionVencida,
  docsFaltantes,
  Metricas,
} from './metrics.engine';

export type Severidad = 'Alta' | 'Media' | 'Baja';

export interface IssueValidador {
  area: string;
  severidad: Severidad;
  campo: string;
  mensaje: string;
  valorActual?: string;
  valorEsperado?: string;
  recomendacion: string;
}

export interface ValidadorResultado {
  issues: IssueValidador[];
  areas: { area: string; total: number; altas: number; medias: number; bajas: number }[];
  resumen: { total: number; altas: number; medias: number; bajas: number; ok: boolean; mensaje: string };
}

const n = (v: number | null | undefined): number => v ?? 0;
const s = (v: string | number | null | undefined): string =>
  v === null || v === undefined ? '' : String(v);

function push(
  issues: IssueValidador[],
  area: string,
  severidad: Severidad,
  campo: string,
  mensaje: string,
  recomendacion: string,
  valorActual?: string,
  valorEsperado?: string,
): void {
  issues.push({ area, severidad, campo, mensaje, recomendacion, valorActual, valorEsperado });
}

/**
 * Validador integral: 13 áreas del botón VALIDAR CONTRATO (files/05 §4).
 * Alta impide guardar; Media/Baja son advertencias aceptables (422 + force).
 */
export function validarContratoCompleto(
  ctx: ContractCtx,
  m: Metricas,
  hoy: string,
  params: ParametrosAlerta,
): ValidadorResultado {
  const c = ctx.contract;
  const issues: IssueValidador[] = [];
  const cerrado = ESTADOS_CERRADOS.includes(c.estado);
  const activo = c.estado === 'Activo';

  // ── Fechas ─────────────────────────────────────────────────────────────────
  if (!c.fechaFirma || !c.fechaInicio || !c.fechaFin) {
    push(issues, 'Fechas', 'Alta', 'fechas',
      'Faltan la fecha de firma, de inicio o de terminación.',
      'Complete las tres fechas del contrato.',
      faltasFechas(c));
  }
  if (c.fechaFirma && c.fechaInicio && diffDias(c.fechaFirma, c.fechaInicio) < 0) {
    push(issues, 'Fechas', 'Media', 'fechaInicio',
      'La fecha de inicio es anterior a la fecha de firma.',
      'Revise la cronología del proceso.',
      c.fechaInicio, `≥ ${c.fechaFirma}`);
  }
  if (c.fechaInicio && c.fechaFin && diffDias(c.fechaInicio, c.fechaFin) < 0) {
    push(issues, 'Fechas', 'Alta', 'fechaFin',
      'La fecha de terminación es anterior a la fecha de inicio.',
      'Corrija la fecha de terminación.',
      c.fechaFin, `≥ ${c.fechaInicio}`);
  }
  if (activo && c.fechaFin && diffDias(hoy, c.fechaFin) < 0) {
    push(issues, 'Fechas', 'Alta', 'fechaFin',
      'El contrato sigue activo pero su plazo ya venció.',
      'Registre una prórroga o termine el contrato.', c.fechaFin, `> ${hoy}`);
  }

  // ── Modificaciones ────────────────────────────────────────────────────────
  const prorrogas = ctx.modifications.filter(
    (x) => !x.anulado && x.estado !== 'Anulada' && x.tipo === 'Prórroga' && x.fechaNueva,
  );
  if (prorrogas.length) {
    const ultima = prorrogas[prorrogas.length - 1];
    if (c.fechaFin && ultima.fechaNueva && ultima.fechaNueva !== c.fechaFin) {
      push(issues, 'Modificaciones', 'Media', 'fechaFin',
        'La fecha de terminación no coincide con la última prórroga registrada.',
        'Ajuste la fecha de terminación o anule y registre de nuevo la modificación.',
        c.fechaFin, ultima.fechaNueva);
    }
  }
  for (const susp of ctx.modifications.filter(
    (x) => !x.anulado && x.estado !== 'Anulada' && x.tipo === 'Suspensión' && x.fecha,
  )) {
    if (c.fechaInicio && c.fechaFin && (diffDias(c.fechaInicio, susp.fecha as string) < 0 ||
        diffDias(susp.fecha as string, c.fechaFin) < 0)) {
      push(issues, 'Modificaciones', 'Media', 'fecha',
        'Hay una suspensión registrada fuera del periodo de ejecución.',
        'Revise la fecha de la suspensión.', susp.fecha ?? undefined,
        `${c.fechaInicio} a ${c.fechaFin}`);
    }
  }

  // ── Valores ───────────────────────────────────────────────────────────────
  const sumaAdicionesMods = ctx.modifications
    .filter((x) => !x.anulado && x.estado !== 'Anulada' && x.tipo === 'Adición')
    .reduce((t, x) => t + n(x.valorNuevo) - n(x.valorAnterior), 0);
  if (n(c.adiciones) !== sumaAdicionesMods) {
    push(issues, 'Valores', 'Media', 'adiciones',
      'Las adiciones del contrato no coinciden con las modificaciones registradas.',
      'Registre las adiciones que falten o corrija las modificaciones.',
      s(n(c.adiciones)), s(sumaAdicionesMods));
  }
  if (m.ejecutado > m.valorActual) {
    push(issues, 'Valores', 'Alta', 'ejecutado',
      'El valor ejecutado es mayor que el valor actualizado.',
      'Registre la adición correspondiente o corrija la ejecución.',
      s(m.ejecutado), `≤ ${m.valorActual}`);
  }
  if (n(c.reducciones) > m.valorInicial + n(c.adiciones)) {
    push(issues, 'Valores', 'Alta', 'reducciones',
      'Las reducciones superan el valor inicial más las adiciones.',
      'Corrija el valor de las reducciones.',
      s(n(c.reducciones)), `≤ ${m.valorInicial + n(c.adiciones)}`);
  }
  if (m.saldo < 0) {
    push(issues, 'Valores', 'Alta', 'saldo',
      'El saldo del contrato es negativo.',
      'Registre la adición correspondiente.', s(m.saldo), '≥ 0');
  }
  if (n(c.adiciones) > m.valorInicial * 0.5) {
    push(issues, 'Valores', 'Media', 'adiciones',
      'Las adiciones superan el 50 % del valor inicial.',
      'Justifique las adiciones o revise su valor.', s(n(c.adiciones)),
      `≤ ${Math.round(m.valorInicial * 0.5)}`);
  }

  // ── Porcentajes ───────────────────────────────────────────────────────────
  if (m.pctFis > 100) {
    push(issues, 'Porcentajes', 'Alta', 'avanceFisico',
      'La ejecución física supera el 100 %.',
      'Corrija el avance físico.', s(m.pctFis), '≤ 100');
  }

  // ── Ejecución ─────────────────────────────────────────────────────────────
  if (Math.abs(m.pctFin - m.pctFis) > params.gapPct) {
    push(issues, 'Ejecución', 'Media', 'avanceFisico',
      `La brecha entre ejecución financiera y física es de ${Math.abs(m.pctFin - m.pctFis)} pp (mayor a ${params.gapPct}).`,
      'Actualice el avance físico o revise los registros de ejecución.',
      s(m.pctFis), s(m.pctFin));
  }
  if (m.pctTiempo > 90 && m.pctFis < 70) {
    push(issues, 'Ejecución', 'Media', 'avanceFisico',
      `Más del 90 % del plazo transcurrido (${m.pctTiempo} %) con menos del 70 % de avance físico (${m.pctFis} %).`,
      'Revise el avance físico y el cumplimiento del cronograma.',
      s(m.pctFis), '≥ 70');
  }

  // ── Pagos ─────────────────────────────────────────────────────────────────
  if (m.pagado > m.valorActual) {
    push(issues, 'Pagos', 'Alta', 'pagado',
      'El valor pagado supera el valor actualizado del contrato.',
      'Revise los pagos registrados.', s(m.pagado), `≤ ${m.valorActual}`);
  }
  for (const p of ctx.payments.filter((x) => !x.anulado && x.neto !== undefined && x.neto !== null)) {
    const esperado = p.bruto + n(p.iva) - n(p.retenciones);
    if (n(p.neto) !== esperado) {
      push(issues, 'Pagos', 'Media', 'neto',
        `El pago ${p.id} tiene un neto distinto de bruto + IVA − retenciones.`,
        'Recalcule el neto del pago.', s(p.neto), s(esperado));
    }
  }
  for (const p of ctx.payments.filter((x) => !x.anulado && x.estado === 'Pagado' && !x.soporte)) {
    push(issues, 'Pagos', 'Baja', 'soporte',
      `El pago ${p.id} está marcado como pagado sin soporte.`,
      'Cargue el soporte del pago.', '');
  }

  // ── Garantías ─────────────────────────────────────────────────────────────
  const gar = ctx.guarantees.filter((g) => !g.anulado && g.estado !== 'Anulada');
  if (!cerrado && gar.length === 0) {
    push(issues, 'Garantías', 'Alta', 'guarantees',
      'El contrato no está cerrado y no tiene garantías.',
      'Registre al menos la garantía de cumplimiento.');
  }
  for (const g of gar.filter((x) => x.estado === 'Aprobada' && x.fechaVenc && diffDias(hoy, x.fechaVenc) < 0)) {
    push(issues, 'Garantías', 'Alta', 'fechaVenc',
      `La póliza ${g.poliza} está aprobada y vencida.`,
      'Registre su renovación o ampliación.', g.fechaVenc ?? undefined, `> ${hoy}`);
  }
  const cumplimiento = gar.find((g) => g.tipo === 'Cumplimiento' && g.estado === 'Aprobada');
  // No cubre el plazo actual: la póliza vence ANTES que la terminación del contrato.
  if (cumplimiento && c.fechaFin && cumplimiento.fechaVenc && diffDias(cumplimiento.fechaVenc, c.fechaFin) > 0) {
    push(issues, 'Garantías', 'Media', 'fechaVenc',
      `La póliza de cumplimiento ${cumplimiento.poliza} no cubre el plazo actual del contrato.`,
      'Amplie la vigencia de la póliza.', cumplimiento.fechaVenc, `≥ ${c.fechaFin}`);
  }
  if (cumplimiento && n(cumplimiento.porcentaje) > 0) {
    const esperado = Math.round((n(cumplimiento.porcentaje) / 100) * m.valorActual);
    if (n(cumplimiento.valor) < esperado) {
      push(issues, 'Garantías', 'Media', 'valor',
        `El valor asegurado de cumplimiento es menor que el ${cumplimiento.porcentaje} % del valor actualizado.`,
        'Revise el valor asegurado de la póliza.', s(cumplimiento.valor), s(esperado));
    }
  }

  // ── Obligaciones ──────────────────────────────────────────────────────────
  const vencidas = ctx.obligations.filter((o) => !o.anulado && (obligacionVencida(o, hoy) || o.estado === 'Incumplida'));
  if (vencidas.length >= 3) {
    push(issues, 'Obligaciones', 'Alta', 'obligations',
      `Hay ${vencidas.length} obligaciones vencidas o incumplidas.`,
      'Atienda o cierre las obligaciones vencidas.');
  } else if (vencidas.length >= 1) {
    push(issues, 'Obligaciones', 'Media', 'obligations',
      `Hay ${vencidas.length} obligación(es) vencida(s) o incumplida(s).`,
      'Atienda o cierre las obligaciones vencidas.');
  }
  if (ctx.obligations.filter((o) => !o.anulado).length === 0) {
    push(issues, 'Obligaciones', 'Baja', 'obligations',
      'El contrato no tiene obligaciones registradas.',
      'Registre las obligaciones del contrato.');
  }

  // ── Documentos ────────────────────────────────────────────────────────────
  const faltantes = docsFaltantes(ctx.documents);
  if (faltantes.length) {
    push(issues, 'Documentos', 'Media', 'documents',
      `Faltan documentos requeridos: ${faltantes.join(', ')}.`,
      'Cargue los documentos que faltan.', '', faltantes.join(', '));
  }

  // ── Subcontratos ──────────────────────────────────────────────────────────
  const subs = ctx.subcontracts.filter((x) => !x.anulado && x.estado !== 'Anulado');
  const sumaSubs = subs.reduce((t, x) => t + x.valor, 0);
  if (sumaSubs > m.valorActual) {
    push(issues, 'Subcontratos', 'Alta', 'subcontracts',
      'El valor subcontratado es mayor que el valor del contrato.',
      'Revise los valores de los subcontratos.', s(sumaSubs), `≤ ${m.valorActual}`);
  }
  for (const sub of subs.filter((x) => x.fechaFin && c.fechaFin && diffDias(x.fechaFin, c.fechaFin) < 0)) {
    push(issues, 'Subcontratos', 'Media', 'fechaFin',
      `${sub.id} termina después del contrato principal.`,
      'Ajuste la fecha del subcontrato.', sub.fechaFin ?? undefined, `≤ ${c.fechaFin}`);
  }

  // ── Riesgos ───────────────────────────────────────────────────────────────
  const riesgosAltos = ctx.risks.filter(
    (r) => !r.anulado && r.estado === 'Abierto' &&
      (nivelRiesgo(r.prob, r.impacto) === 'Alto' || nivelRiesgo(r.prob, r.impacto) === 'Extremo'),
  );
  if (riesgosAltos.length) {
    push(issues, 'Riesgos', 'Media', 'risks',
      `Hay ${riesgosAltos.length} riesgo(s) alto(s) o extremo(s) abiertos.`,
      'Defina o cierre el tratamiento de los riesgos altos.');
  }

  // ── Incumplimientos ───────────────────────────────────────────────────────
  const incAbiertos = ctx.breaches.filter(
    (b) => !b.anulado && !['Cerrado', 'Subsanado'].includes(b.estado ?? ''),
  );
  if (incAbiertos.length) {
    push(issues, 'Incumplimientos', 'Media', 'breaches',
      `Hay ${incAbiertos.length} incumplimiento(s) abierto(s).`,
      'Gestione y cierre los incumplimientos.');
  }

  // ── Liquidación ───────────────────────────────────────────────────────────
  const sinLiquidacion =
    ['Terminado', 'En liquidación'].includes(c.estado) &&
    !hayActaLiquidacion(ctx);
  if (sinLiquidacion) {
    push(issues, 'Liquidación', 'Media', 'actas',
      'El contrato está terminado o en liquidación sin acta de liquidación.',
      'Registre el acta de liquidación.');
  }
  if (c.estado === 'Liquidado' && m.saldo > 0) {
    push(issues, 'Liquidación', 'Baja', 'saldo',
      'El contrato está liquidado con saldo por liberar.',
      'Verifique si corresponde liberar recursos.', s(m.saldo), '0');
  }

  return resumir(issues);
}

/** Acta de liquidación registrada: acta del catálogo o documento de categoría Liquidación. */
function hayActaLiquidacion(ctx: ContractCtx): boolean {
  return (
    ctx.actas.some(
      (a) => !a.anulado && a.estado !== 'Anulada' && a.tipo === 'Acta de liquidación',
    ) ||
    ctx.documents.some(
      (d) => !d.anulado && d.estado !== 'Anulada' && d.categoria === 'Liquidación',
    )
  );
}

function faltasFechas(c: ContractBase): string {
  const faltan: string[] = [];
  if (!c.fechaFirma) faltan.push('firma');
  if (!c.fechaInicio) faltan.push('inicio');
  if (!c.fechaFin) faltan.push('terminación');
  return `Faltan: ${faltan.join(', ')}`;
}

function resumir(issues: IssueValidador[]): ValidadorResultado {
  const porArea = new Map<string, { total: number; altas: number; medias: number; bajas: number }>();
  for (const i of issues) {
    const a = porArea.get(i.area) ?? { total: 0, altas: 0, medias: 0, bajas: 0 };
    a.total += 1;
    if (i.severidad === 'Alta') a.altas += 1;
    else if (i.severidad === 'Media') a.medias += 1;
    else a.bajas += 1;
    porArea.set(i.area, a);
  }
  const areas = [...porArea.entries()].map(([area, v]) => ({ area, ...v }));
  const resumen = {
    total: issues.length,
    altas: issues.filter((i) => i.severidad === 'Alta').length,
    medias: issues.filter((i) => i.severidad === 'Media').length,
    bajas: issues.filter((i) => i.severidad === 'Baja').length,
    ok: issues.length === 0,
    mensaje: issues.length === 0 ? 'Contrato validado correctamente' : `Se encontraron ${issues.length} inconsistencias`,
  };
  return { issues, areas, resumen };
}

/**
 * Validator.draft: validaciones del formulario de contrato (alta impide guardar,
 * media/baja son advertencias aceptables con force=true).
 */
export function validarBorrador(
  c: Partial<ContractBase>,
): IssueValidador[] {
  const issues: IssueValidador[] = [];
  if (c.fechaFirma && c.fechaInicio && diffDias(c.fechaFirma, c.fechaInicio) < 0) {
    push(issues, 'Fechas', 'Media', 'fechaInicio',
      'La fecha de inicio es anterior a la fecha de firma.',
      'Revise la cronología del proceso.', c.fechaInicio, `≥ ${c.fechaFirma}`);
  }
  if (c.fechaInicio && c.fechaFin && diffDias(c.fechaInicio, c.fechaFin) < 0) {
    push(issues, 'Fechas', 'Alta', 'fechaFin',
      'La fecha de terminación es anterior a la fecha de inicio.',
      'Corrija la fecha de terminación.', c.fechaFin, `≥ ${c.fechaInicio}`);
  }
  if (n(c.avanceFisico) > 100) {
    push(issues, 'Porcentajes', 'Alta', 'avanceFisico',
      'La ejecución física supera el 100 %.',
      'Corrija el avance físico.', s(c.avanceFisico), '≤ 100');
  }
  return issues;
}

/** ¿El borrador bloquea el guardado por severidad alta? */
export function bloqueaGuardado(issues: IssueValidador[]): boolean {
  return issues.some((i) => i.severidad === 'Alta');
}

export { redondear1 };
