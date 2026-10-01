/** Paginación estándar de files/03: ?page=1&pageSize=25 → { data, total, page, pageSize }. */
export interface Pagina<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export function paginar<T>(data: T[], total: number, page: number, pageSize: number): Pagina<T> {
  return { data, total, page, pageSize };
}

export function leerPagina(query: Record<string, unknown> | object, defecto: number): { page: number; pageSize: number } {
  const q = query as Record<string, unknown>;
  const page = Math.max(1, Math.trunc(Number(q.page)) || 1);
  const pageSize = Math.min(500, Math.max(1, Math.trunc(Number(q.pageSize)) || defecto));
  return { page, pageSize };
}

/** Parte una lista ya filtrada en memoria (se usa cuando los filtros dependen de métricas calculadas). */
export function partirEnMemoria<T>(items: T[], page: number, pageSize: number): { items: T[]; total: number } {
  return { items: items.slice((page - 1) * pageSize, page * pageSize), total: items.length };
}
