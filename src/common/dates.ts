/** Utilidades de fechas para el negocio (zonas: America/Bogota; formato ISO AAAA-MM-DD). */
const TZ = 'America/Bogota';
const MS_DIA = 86_400_000;

/** Hoy como ISO AAAA-MM-DD en la zona horaria del negocio. */
export function hoyISO(tz = TZ): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: tz });
}

/** Fecha (AAAA-MM-DD) y hora (HH:mm:ss) para la auditoría. */
export function fechaHora(ahora = new Date()): { fecha: string; hora: string } {
  return {
    fecha: ahora.toLocaleDateString('en-CA', { timeZone: TZ }),
    hora: ahora.toLocaleTimeString('en-GB', { timeZone: TZ, hour12: false }),
  };
}

/** Días entre dos ISO: hasta − desde (positivo si hasta es posterior). */
export function diffDias(desde: string, hasta: string): number {
  return Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / MS_DIA);
}

/** Suma (o resta con negativo) días a una fecha ISO. */
export function sumarDias(iso: string, dias: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + dias * MS_DIA).toISOString().slice(0, 10);
}

/** Restar días: azúcar sobre sumarDias. */
export function restarDias(iso: string, dias: number): string {
  return sumarDias(iso, -dias);
}

/** Periodo 'AAAA-MM' de hace N meses respecto a hoy. */
export function periodoHace(nMeses: number, hoy = hoyISO()): string {
  const d = new Date(`${hoy}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() - nMeses);
  return d.toISOString().slice(0, 7);
}

/** 'AAAA-MM' → 'AAAA-MM-01' (para ordenar/consultar). */
export function periodoAFecha(p: string): string {
  return `${p}-01`;
}

/** Redondeo a 1 decimal usado en porcentajes y meses. */
export function redondear1(x: number): number {
  return Math.round(x * 10) / 10;
}
