import { diffDias } from '../common/dates';
import {
  ESTADOS_CERRADOS,
  ContractCtx,
  nivelRiesgo,
  ParametrosAlerta,
} from './types';
import { Metricas, entregableVencido, obligacionVencida, docsFaltantes } from './metrics.engine';

export type NivelAlerta = 'critica' | 'riesgo' | 'proxima' | 'informativa';

export interface AlertaCalculada {
  /** Clave estable: `contrato|CT-01|30`, `gar|GR-07|15`, `cupo|CP-03|85`… */
  key: string;
  tipo: string;
  nivel: NivelAlerta;
  titulo: string;
  descripcion: string;
  contractId?: string | null;
  refId: string;
  dias?: number | null;
}

/** Nivel de una alerta de plazo según los días que faltan. */
export function nivelPorDias(dias: number, criticalDays: number): NivelAlerta {
  if (dias <= criticalDays) return 'critica';
  if (dias <= 15) return 'riesgo';
  return 'proxima';
}

/** Alertas de un contrato (no se guardan: se recalculan). files/05 §3. */
export function calcularAlertas(
  ctx: ContractCtx,
  m: Metricas,
  params: ParametrosAlerta,
  hoy: string,
): AlertaCalculada[] {
  const out: AlertaCalculada[] = [];
  const c = ctx.contract;
  if (c.anulado) return out;
  const cerrado = ESTADOS_CERRADOS.includes(c.estado);
  const activo = c.estado === 'Activo';

  // 1–2. Vencimiento de contrato (por umbral cruzado) y contrato vencido
  if (activo && c.fechaFin) {
    const dias = diffDias(hoy, c.fechaFin);
    if (dias >= 0) {
      for (const u of params.alertDays) {
        if (dias <= u) {
          out.push({
            key: `contrato|${c.id}|${u}`,
            tipo: 'Vencimiento de contrato',
            nivel: nivelPorDias(dias, params.criticalDays),
            titulo: `Contrato ${c.numero} vence en ${dias} días`,
            descripcion: `La fecha de terminación (${c.fechaFin}) cruza el umbral de ${u} días.`,
            contractId: c.id,
            refId: c.id,
            dias,
          });
        }
      }
    } else {
      out.push({
        key: `contrato|${c.id}|v`,
        tipo: 'Contrato vencido',
        nivel: 'critica',
        titulo: `Contrato ${c.numero} vencido`,
        descripcion: `El contrato sigue activo y su fecha de terminación (${c.fechaFin}) ya pasó.`,
        contractId: c.id,
        refId: c.id,
        dias,
      });
    }
  }

  // 3–4. Garantías (póliza aprobada, contrato no cerrado)
  if (!cerrado) {
    for (const g of ctx.guarantees.filter((x) => !x.anulado && x.estado === 'Aprobada')) {
      if (!g.fechaVenc) continue;
      const dias = diffDias(hoy, g.fechaVenc);
      if (dias < 0) {
        out.push({
          key: `gar|${g.id}|v`,
          tipo: 'Garantía vencida',
          nivel: 'critica',
          titulo: `Garantía ${g.poliza} vencida`,
          descripcion: `La póliza aprobada venció el ${g.fechaVenc} y el contrato está en curso.`,
          contractId: c.id,
          refId: g.id,
          dias,
        });
      } else {
        for (const u of params.alertDays) {
          if (dias <= u) {
            out.push({
              key: `gar|${g.id}|${u}`,
              tipo: 'Garantía próxima a vencer',
              nivel: nivelPorDias(dias, params.criticalDays),
              titulo: `Garantía ${g.poliza} vence en ${dias} días`,
              descripcion: `La póliza aprobada cruza el umbral de ${u} días.`,
              contractId: c.id,
              refId: g.id,
              dias,
            });
          }
        }
      }
    }
  }

  // 5–6. Obligaciones vencidas e incumplidas
  for (const o of ctx.obligations.filter((x) => !x.anulado)) {
    if (obligacionVencida(o, hoy)) {
      out.push({
        key: `obl|${o.id}|v`,
        tipo: 'Obligación vencida',
        nivel: 'riesgo',
        titulo: 'Obligación vencida',
        descripcion: `${o.id}: la fecha límite (${o.fechaLimite}) ya pasó y sigue sin cumplir.`,
        contractId: c.id,
        refId: o.id,
      });
    }
    if (o.estado === 'Incumplida') {
      out.push({
        key: `obl|${o.id}|i`,
        tipo: 'Obligación incumplida',
        nivel: 'critica',
        titulo: 'Obligación incumplida',
        descripcion: `${o.id} está marcada como Incumplida.`,
        contractId: c.id,
        refId: o.id,
      });
    }
  }

  // 7. Entregables vencidos
  for (const d of ctx.deliverables.filter((x) => !x.anulado && entregableVencido(x, hoy))) {
    out.push({
      key: `ent|${d.id}|v`,
      tipo: 'Entregable vencido',
      nivel: 'riesgo',
      titulo: 'Entregable vencido',
      descripcion: `${d.id}: la fecha programada (${d.fechaProg}) ya pasó sin entrega.`,
      contractId: c.id,
      refId: d.id,
    });
  }

  // 8. Pagos pendientes o en revisión
  for (const p of ctx.payments.filter(
    (x) => !x.anulado && (x.estado === 'Pendiente' || x.estado === 'En revisión'),
  )) {
    out.push({
      key: `pag|${p.id}|p`,
      tipo: 'Pago pendiente',
      nivel: 'informativa',
      titulo: `Pago ${p.id} ${p.estado}`,
      descripcion: `Hay un pago ${p.estado} por gestionar.`,
      contractId: c.id,
      refId: p.id as string,
    });
  }

  // 9. Ejecución superior al límite
  if (!cerrado && m.pctFin > 100) {
    out.push({
      key: `ejec|${c.id}|o`,
      tipo: 'Ejecución superior al límite',
      nivel: 'critica',
      titulo: 'Ejecución financiera superior al 100 %',
      descripcion: `La ejecución financiera es ${m.pctFin} % del valor actualizado.`,
      contractId: c.id,
      refId: c.id,
    });
  }

  // 10. Presupuesto próximo a agotarse
  if (activo && m.pctSaldo < params.budgetPct) {
    out.push({
      key: `ejec|${c.id}|s`,
      tipo: 'Presupuesto próximo a agotarse',
      nivel: 'riesgo',
      titulo: 'Presupuesto próximo a agotarse',
      descripcion: `El saldo es ${m.pctSaldo} % del valor actualizado. El contrato está próximo a agotar sus recursos.`,
      contractId: c.id,
      refId: c.id,
    });
  }

  // 11. Incumplimientos abiertos
  for (const b of ctx.breaches.filter(
    (x) => !x.anulado && !['Cerrado', 'Subsanado'].includes(x.estado ?? ''),
  )) {
    out.push({
      key: `inc|${b.id}|v`,
      tipo: 'Incumplimiento abierto',
      nivel: b.impacto === 'Alto' ? 'critica' : 'riesgo',
      titulo: 'Incumplimiento abierto',
      descripcion: `${b.id}: incumplimiento sin cerrar ni subsanar (impacto ${b.impacto ?? 'n/d'}).`,
      contractId: c.id,
      refId: b.id,
    });
  }

  // 12. Documentos requeridos faltantes
  for (const cat of docsFaltantes(ctx.documents)) {
    out.push({
      key: `doc|${c.id}|${cat}`,
      tipo: 'Documento faltante',
      nivel: 'informativa',
      titulo: 'Documento faltante',
      descripcion: `Falta un documento de la categoría «${cat}».`,
      contractId: c.id,
      refId: cat,
    });
  }

  return out;
}

export interface CupoParaAlertas {
  id: string;
  aseguradora: string;
  numero: string;
  valor: number;
  estado: string;
  fechaVenc?: string | null;
}

/** 13–16. Alertas de cupos (files/06). */
export function calcularAlertasCupos(
  cupos: (CupoParaAlertas & { stats: { pctUso: number } })[],
  params: ParametrosAlerta,
  hoy: string,
): AlertaCalculada[] {
  const out: AlertaCalculada[] = [];
  for (const cp of cupos) {
    if (cp.estado === 'Anulado') continue;
    if (cp.stats.pctUso > 100) {
      out.push({
        key: `cupo|${cp.id}|o`,
        tipo: 'Cupo de póliza excedido',
        nivel: 'critica',
        titulo: `Cupo ${cp.numero} excedido`,
        descripcion: `El uso del cupo de ${cp.aseguradora} es ${cp.stats.pctUso} % (mayor a 100 %).`,
        refId: cp.id,
      });
    } else if (cp.stats.pctUso >= 85) {
      out.push({
        key: `cupo|${cp.id}|85`,
        tipo: 'Cupo de póliza próximo a agotarse',
        nivel: 'riesgo',
        titulo: `Cupo ${cp.numero} próximo a agotarse`,
        descripcion: `El uso del cupo de ${cp.aseguradora} es ${cp.stats.pctUso} % (85 % o más).`,
        refId: cp.id,
      });
    }
    if (cp.estado === 'Vigente' && cp.fechaVenc) {
      const dias = diffDias(hoy, cp.fechaVenc);
      if (dias < 0) {
        out.push({
          key: `cupo|${cp.id}|v`,
          tipo: 'Cupo de póliza vencido',
          nivel: 'critica',
          titulo: `Cupo ${cp.numero} vencido`,
          descripcion: `El cupo sigue Vigente pero su vigencia venció el ${cp.fechaVenc}.`,
          refId: cp.id,
          dias,
        });
      } else {
        for (const u of params.alertDays) {
          if (dias <= u) {
            out.push({
              key: `cupo|${cp.id}|${u}`,
              tipo: 'Vigencia de cupo por vencer',
              nivel: nivelPorDias(dias, params.criticalDays),
              titulo: `Cupo ${cp.numero} vence en ${dias} días`,
              descripcion: `La vigencia del cupo cruza el umbral de ${u} días.`,
              refId: cp.id,
              dias,
            });
          }
        }
      }
    }
  }
  return out;
}

export { nivelRiesgo };
