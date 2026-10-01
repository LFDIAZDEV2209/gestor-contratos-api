import { diffDias } from '../common/dates';

/** Datos extraídos del documento firmado (categoría «Contrato») para la conciliación. */
export interface DatosExtraidos {
  valor?: number | null;
  fechaInicio?: string | null;
  fechaFin?: string | null;
  plazoDias?: number | null;
  objeto?: string | null;
  contratista?: string | null;
  nit?: string | null;
  garantias?: string[] | null;
  origen?: string | null;
}

export interface CampoConciliacion {
  campo: string;
  documento: string | null;
  sistema: string | null;
  coincide: boolean | null;
}

export interface ConciliacionResultado {
  disponible: boolean;
  mensaje?: string;
  campos: CampoConciliacion[];
  diferencias: number;
}

interface SistemaContrato {
  valorInicial?: number | null;
  fechaInicio?: string | null;
  fechaFin?: string | null;
  duracionDias?: number | null;
  objeto?: string | null;
  contratista?: string | null;
  nitContratista?: string | null;
  tiposGarantia?: string[];
}

const soloDigitos = (v: string): string => v.replace(/\D/g, '');

/**
 * Conciliación sistema vs. documento (files/05 §5). Cada campo se marca
 * «Coincide» o «DIFERENCIA DETECTADA» con el criterio de coincidencia indicado.
 */
export function conciliar(sis: SistemaContrato, doc: DatosExtraidos | null): ConciliacionResultado {
  if (!doc) {
    return {
      disponible: false,
      mensaje: 'No hay un documento de categoría «Contrato» con datos extraídos para conciliar.',
      campos: [],
      diferencias: 0,
    };
  }
  const campos: CampoConciliacion[] = [];
  let diferencias = 0;

  const agregar = (campo: string, docV: string | null, sisV: string | null, coincide: boolean | null): void => {
    if (coincide === false) diferencias += 1;
    campos.push({ campo, documento: docV, sistema: sisV, coincide });
  };

  // Valor: diferencia menor a un peso
  if (doc.valor != null) {
    const sisVal = sis.valorInicial ?? null;
    const coincide = sisVal != null ? Math.abs(sisVal - doc.valor) < 1 : false;
    agregar('Valor', String(doc.valor), sisVal != null ? String(sisVal) : null, coincide);
  }
  // Fechas: igualdad exacta
  agregar('Fecha de inicio', doc.fechaInicio ?? null, sis.fechaInicio ?? null, !!doc.fechaInicio && doc.fechaInicio === sis.fechaInicio);
  agregar('Fecha de terminación', doc.fechaFin ?? null, sis.fechaFin ?? null, !!doc.fechaFin && doc.fechaFin === sis.fechaFin);
  // Plazo: días del documento vs duración calculada
  if (doc.plazoDias != null) {
    const coincide = sis.duracionDias != null ? doc.plazoDias === sis.duracionDias : false;
    agregar('Plazo (días)', String(doc.plazoDias), sis.duracionDias != null ? String(sis.duracionDias) : null, coincide);
  }
  // Objeto: igualdad sin espacios en los extremos
  if (doc.objeto != null) {
    const coincide = sis.objeto != null ? doc.objeto.trim() === sis.objeto.trim() : false;
    agregar('Objeto', doc.objeto, sis.objeto ?? null, coincide);
  }
  // Contratista: igualdad sin distinguir mayúsculas
  if (doc.contratista != null) {
    const coincide = sis.contratista != null ? doc.contratista.toLowerCase() === sis.contratista.toLowerCase() : false;
    agregar('Contratista', doc.contratista, sis.contratista ?? null, coincide);
  }
  // NIT: solo dígitos (ignora puntos y guiones)
  if (doc.nit != null) {
    const coincide = sis.nitContratista != null ? soloDigitos(doc.nit) === soloDigitos(sis.nitContratista) : false;
    agregar('NIT', doc.nit, sis.nitContratista ?? null, coincide);
  }
  // Garantías: igualdad de tipos, si el documento los indica
  if (doc.garantias && doc.garantias.length) {
    const docSet = [...doc.garantias].map((x) => x.toLowerCase()).sort();
    const sisSet = [...(sis.tiposGarantia ?? [])].map((x) => x.toLowerCase()).sort();
    const coincide = docSet.length === sisSet.length && docSet.every((v, i) => v === sisSet[i]);
    agregar('Garantías', doc.garantias.join(', '), sis.tiposGarantia?.join(', ') ?? null, coincide);
  }

  return { disponible: true, campos, diferencias };
}

/** Duración en días a partir de las fechas del sistema (para comparar con el plazo del documento). */
export function duracionDe(fechaInicio: string | null | undefined, fechaFin: string | null | undefined): number | null {
  if (!fechaInicio || !fechaFin) return null;
  return diffDias(fechaInicio, fechaFin) + 1;
}
