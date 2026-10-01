/** Registro de colecciones hijas del contrato (files/03). */
export interface ColeccionDef {
  nombre: string;
  prefijo: string;
  /** Nombre en la auditoría. */
  modulo: string;
  /** modifications no se editan: se anulan y se registra una nueva. */
  permiteEditar: boolean;
  /** Columna de estado para anular; null ⇒ usa motivoAnulacion (execs). */
  campoEstado: string | null;
}

export const COLECCIONES_HIJAS: ColeccionDef[] = [
  { nombre: 'subcontracts', prefijo: 'SC', modulo: 'Subcontratos', permiteEditar: true, campoEstado: 'estado' },
  { nombre: 'obligations', prefijo: 'OB', modulo: 'Obligaciones', permiteEditar: true, campoEstado: 'estado' },
  { nombre: 'deliverables', prefijo: 'EN', modulo: 'Entregables', permiteEditar: true, campoEstado: 'estado' },
  { nombre: 'execs', prefijo: 'EX', modulo: 'Ejecución', permiteEditar: true, campoEstado: null },
  { nombre: 'payments', prefijo: 'PG', modulo: 'Pagos', permiteEditar: true, campoEstado: 'estado' },
  { nombre: 'actas', prefijo: 'AC', modulo: 'Actas', permiteEditar: true, campoEstado: 'estado' },
  { nombre: 'modifications', prefijo: 'MD', modulo: 'Modificaciones', permiteEditar: false, campoEstado: 'estado' },
  { nombre: 'risks', prefijo: 'RG', modulo: 'Riesgos', permiteEditar: true, campoEstado: 'estado' },
  { nombre: 'breaches', prefijo: 'IN', modulo: 'Incumplimientos', permiteEditar: true, campoEstado: 'estado' },
  { nombre: 'plans', prefijo: 'PM', modulo: 'Planes', permiteEditar: true, campoEstado: 'estado' },
];

/** Colecciones solo listadas aquí (guarantees → módulo de seguros; documents → módulo de documentos). */
export const COLS_LISTA = COLECCIONES_HIJAS.map((c) => c.nombre).join('|');
