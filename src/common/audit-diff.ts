import { EntradaAuditoria } from '../modules/audit/audit.service';

const CAMPOS_TIMESTAMP = new Set(['createdAt', 'updatedAt', 'ts']);

/**
 * Diferencia campo a campo entre dos registros para la auditoría
 * («un registro por campo», files/08). Valores normalizados a texto.
 */
export function entradasPorCampos(
  prev: Record<string, unknown>,
  next: Record<string, unknown>,
  campos: string[],
  base: Omit<EntradaAuditoria, 'campo' | 'anterior' | 'nuevo'>,
): EntradaAuditoria[] {
  const out: EntradaAuditoria[] = [];
  for (const campo of campos) {
    if (CAMPOS_TIMESTAMP.has(campo)) continue;
    const a = normalizar(prev[campo]);
    const b = normalizar(next[campo]);
    if (a === b) continue;
    out.push({ ...base, campo, anterior: a, nuevo: b });
  }
  return out;
}

function normalizar(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return JSON.stringify(v);
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}
