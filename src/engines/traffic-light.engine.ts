import { diffDias } from '../common/dates';
import {
  DOCS_REQUERIDOS,
  ESTADOS_CERRADOS,
  ContractBase,
  ContractCtx,
  nivelRiesgo,
  ParametrosAlerta,
} from './types';
import { Metricas, docsFaltantes, entregableVencido, obligacionVencida } from './metrics.engine';

export type NivelSemaforo = 'normal' | 'atencion' | 'riesgo' | 'critico' | 'info';
export interface Semaforo {
  nivel: NivelSemaforo;
  razones: string[];
}

const RANGO: Record<NivelSemaforo, number> = {
  info: 0,
  normal: 0,
  atencion: 1,
  riesgo: 2,
  critico: 3,
};

interface Factor {
  nivel: NivelSemaforo;
  razon: string;
}

/**
 * Semaforo(c, m): peor nivel de 18 factores con razones (files/05 §2).
 * Casos especiales primero: anulado o sin fechas/valor ⇒ Sin información; liquidado ⇒ Normal.
 */
export function calcularSemaforo(
  c: ContractBase,
  ctx: ContractCtx,
  m: Metricas,
  hoy: string,
  params: ParametrosAlerta,
): Semaforo {
  if (c.anulado) return { nivel: 'info', razones: ['El contrato está anulado.'] };
  if (!c.fechaInicio || !c.fechaFin) {
    return { nivel: 'info', razones: ['El contrato no tiene fechas registradas.'] };
  }
  if (m.valorActual <= 0) {
    return { nivel: 'info', razones: ['El contrato no tiene valor registrado.'] };
  }
  if (c.estado === 'Liquidado') return { nivel: 'normal', razones: ['Contrato liquidado.'] };

  const factores: Factor[] = [];
  const activo = c.estado === 'Activo';
  const enCurso = !ESTADOS_CERRADOS.includes(c.estado);

  // Plazo (4 factores)
  if (activo && m.restantes < 0) {
    factores.push({ nivel: 'critico', razon: `El contrato venció el ${c.fechaFin} y sigue activo.` });
  } else if (activo && m.restantes <= params.criticalDays) {
    factores.push({ nivel: 'critico', razon: `El contrato vence en ${m.restantes} días.` });
  } else if (activo && m.restantes <= 15) {
    factores.push({ nivel: 'riesgo', razon: `El contrato vence en ${m.restantes} días.` });
  } else if (activo && m.restantes <= 30) {
    factores.push({ nivel: 'atencion', razon: `El contrato vence en ${m.restantes} días.` });
  }

  // Ejecución financiera
  if (m.pctFin > 100) {
    factores.push({ nivel: 'critico', razon: `La ejecución financiera supera el 100 % (${m.pctFin} %).` });
  }
  if (activo && m.pctSaldo < params.budgetPct) {
    factores.push({
      nivel: 'riesgo',
      razon: `El saldo es ${m.pctSaldo} % del valor actualizado. El contrato está próximo a agotar sus recursos.`,
    });
  }
  if (m.seAgotaAntesDelPlazo && m.fechaAgotamiento) {
    factores.push({
      nivel: 'atencion',
      razon: `Al ritmo actual los recursos se agotan el ${m.fechaAgotamiento}, antes del plazo.`,
    });
  }

  // Ejecución física
  if (m.pctFis > 100) {
    factores.push({ nivel: 'critico', razon: `La ejecución física supera el 100 % (${m.pctFis} %).` });
  }
  // La brecha exige registros de ejecución: sin ellos no es comparable.
  const hayExecs = ctx.execs.some((e) => !e.anulado);
  if (activo && hayExecs && Math.abs(m.pctFin - m.pctFis) > params.gapPct) {
    factores.push({
      nivel: 'atencion',
      razon: `Brecha de ${Math.abs(m.pctFin - m.pctFis)} pp entre ejecución financiera y física.`,
    });
  }

  // Obligaciones vencidas o incumplidas
  const obligMal = ctx.obligations.filter(
    (o) => !o.anulado && (obligacionVencida(o, hoy) || o.estado === 'Incumplida'),
  );
  if (obligMal.length >= 3) {
    factores.push({ nivel: 'critico', razon: `${obligMal.length} obligaciones vencidas o incumplidas.` });
  } else if (obligMal.length >= 1) {
    factores.push({ nivel: 'riesgo', razon: `${obligMal.length} obligación(es) vencida(s) o incumplida(s).` });
  }

  // Incumplimientos abiertos
  const incAbiertos = ctx.breaches.filter(
    (b) => !b.anulado && !['Cerrado', 'Subsanado'].includes(b.estado ?? ''),
  );
  if (incAbiertos.length) {
    factores.push({ nivel: 'riesgo', razon: `${incAbiertos.length} incumplimiento(s) abierto(s).` });
  }

  // Garantías (solo contratos en curso)
  if (enCurso) {
    for (const g of ctx.guarantees.filter((x) => !x.anulado && x.estado === 'Aprobada')) {
      if (!g.fechaVenc) continue;
      const dias = diffDias(hoy, g.fechaVenc);
      if (dias < 0) {
        factores.push({
          nivel: 'critico',
          razon: `La garantía ${g.poliza} venció el ${g.fechaVenc} y el contrato está en curso.`,
        });
      } else if (activo && dias <= 15) {
        factores.push({ nivel: 'atencion', razon: `La garantía ${g.poliza} vence en ${dias} días.` });
      }
    }
  }

  // Riesgos altos o extremos abiertos
  const riesgosAltos = ctx.risks.filter(
    (r) => !r.anulado && r.estado === 'Abierto' && nivelRiesgo(r.prob, r.impacto) !== 'Bajo' &&
      nivelRiesgo(r.prob, r.impacto) !== 'Moderado',
  );
  if (riesgosAltos.length) {
    factores.push({ nivel: 'riesgo', razon: `${riesgosAltos.length} riesgo(s) alto(s) o extremo(s) abierto(s).` });
  }

  // Entregables vencidos
  const entVencidos = ctx.deliverables.filter((d) => entregableVencido(d, hoy));
  if (entVencidos.length) {
    factores.push({ nivel: 'atencion', razon: `${entVencidos.length} entregable(s) vencidos.` });
  }

  // Documentos requeridos faltantes
  const faltantes = docsFaltantes(ctx.documents);
  if (faltantes.length) {
    factores.push({ nivel: 'atencion', razon: `Faltan documentos requeridos: ${faltantes.join(', ')}.` });
  }

  // Contrato suspendido
  if (c.estado === 'Suspendido') {
    factores.push({ nivel: 'atencion', razon: 'El contrato está suspendido.' });
  }

  const nivel = factores.reduce<NivelSemaforo>(
    (peor, f) => (RANGO[f.nivel] > RANGO[peor] ? f.nivel : peor),
    'normal',
  );
  return { nivel, razones: factores.map((f) => f.razon) };
}

export { DOCS_REQUERIDOS };
