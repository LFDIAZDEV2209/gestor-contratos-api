import { diffDias } from '../common/dates';
import { cupoStats, CupoStats } from './cupo.engine';

export interface ReglasCupoContexto {
  cupo?: {
    id: string;
    aseguradora: string;
    valor: number;
    estado: string;
    fechaVenc?: string | null;
  } | null;
  polizasDelCupo: { estado?: string | null; valor: number; anulado?: boolean; contractAnulado?: boolean }[];
  hoy: string;
}

export interface ReglaCupo {
  tipo: 'error' | 'advertencia';
  mensaje: string;
}

/**
 * Reglas de pólizas por cupo (files/06). Errores → 400; advertencias → 422 + force.
 *  - Debe tener cupo seleccionado (error).
 *  - El cupo debe ser de la misma aseguradora (error).
 *  - El cupo debe estar Vigente (error).
 *  - El valor asegurado no debe superar el disponible (advertencia).
 *  - La póliza no debe vencer después de la vigencia del cupo (advertencia).
 */
export function reglasDeCupo(
  garantia: { modalidadPoliza?: string | null; cupoId?: string | null; aseguradora: string; valor: number; fechaVenc?: string | null; poliza: string },
  ctx: ReglasCupoContexto,
): ReglaCupo[] {
  const out: ReglaCupo[] = [];
  if (garantia.modalidadPoliza !== 'Póliza por cupo') return out;

  if (!garantia.cupoId) {
    out.push({ tipo: 'error', mensaje: 'Las pólizas por cupo requieren un cupo de la aseguradora.' });
    return out;
  }
  const cp = ctx.cupo;
  if (!cp) {
    out.push({ tipo: 'error', mensaje: `El cupo ${garantia.cupoId} no existe.` });
    return out;
  }
  if (cp.aseguradora !== garantia.aseguradora) {
    out.push({ tipo: 'error', mensaje: `El cupo ${cp.id} pertenece a ${cp.aseguradora}, no a ${garantia.aseguradora}.` });
  }
  if (cp.estado !== 'Vigente') {
    out.push({ tipo: 'error', mensaje: `El cupo ${cp.id} no está Vigente (está ${cp.estado}).` });
  }
  const stats: CupoStats = cupoStats({ id: cp.id, valor: cp.valor }, ctx.polizasDelCupo);
  if (stats.disponible < garantia.valor) {
    out.push({
      tipo: 'advertencia',
      mensaje: `El valor asegurado supera el disponible del cupo (disponible ${stats.disponible}). Se aceptará de todas formas si el usuario lo confirma.`,
    });
  }
  if (garantia.fechaVenc && cp.fechaVenc && diffDias(garantia.fechaVenc, cp.fechaVenc) < 0) {
    out.push({
      tipo: 'advertencia',
      mensaje: 'La póliza vence después de la vigencia del cupo. Se aceptará de todas formas si el usuario lo confirma.',
    });
  }
  return out;
}
