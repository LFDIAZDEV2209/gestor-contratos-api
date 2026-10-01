import { randomBytes } from 'node:crypto';

/**
 * Id con prefijo por entidad según 02-MODELO-DE-DATOS:
 * `PREFIJO-<marca de tiempo base36><aleatorio>`.
 * El seed usa ids fijos (CT-01, EMP-01...) para los datos de demostración.
 */
export function newId(prefix: string): string {
  const ts = Date.now().toString(36);
  const rnd = randomBytes(3).toString('hex');
  return `${prefix}-${ts}${rnd}`.toUpperCase();
}
