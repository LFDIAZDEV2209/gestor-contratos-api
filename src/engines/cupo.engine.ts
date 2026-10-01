import { redondear1 } from '../common/dates';

export interface CupoStats {
  utilizado: number;
  disponible: number;
  pctUso: number;
  polizas: number;
}

interface PolizaCupo {
  cupoId?: string | null;
  estado?: string | null;
  valor: number;
  anulado?: boolean;
  contractAnulado?: boolean;
}

/**
 * cupoStats(cp): utilizado / disponible / % uso / número de pólizas (files/06).
 * Utilizado = pólizas Aprobadas o Pendientes del cupo, de pólizas y contratos no anulados.
 */
export function cupoStats(cupo: { id: string; valor: number }, polizas: PolizaCupo[]): CupoStats {
  const vivas = polizas.filter(
    (p) => !p.anulado && !p.contractAnulado && p.cupoId === cupo.id &&
      (p.estado === 'Aprobada' || p.estado === 'Pendiente'),
  );
  const utilizado = Math.round(vivas.reduce((s, p) => s + p.valor, 0));
  const disponible = cupo.valor - utilizado;
  const pctUso = cupo.valor > 0 ? redondear1((utilizado / cupo.valor) * 100) : 0;
  return { utilizado, disponible, pctUso, polizas: vivas.length };
}
