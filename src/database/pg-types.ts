/** Parsers de node-postgres ajustados para columnas de negocio. */
import { types } from 'pg';

// DATE (1082): devolver el texto ISO 'AAAA-MM-DD' tal cual (evita desfases por zona horaria).
types.setTypeParser(types.builtins.DATE, (v: string) => v);
// NUMERIC (1700): a number (porcentajes).
types.setTypeParser(types.builtins.NUMERIC, (v: string) => (v == null ? null : Number(v)));
