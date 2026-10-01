import { ContractBase } from './types';

export interface CambiosContrato {
  adiciones?: number;
  reducciones?: number;
  fechaFin?: string | null;
  estado?: string;
  contratista?: string;
  supervisor?: string;
}

export interface EfectoModificacion {
  cambios: CambiosContrato;
  /** Aviso: en adiciones, prórrogas y reinicios revisar las pólizas. */
  avisoRevisarPolizas: boolean;
  /** Impacto automático (p. ej. el contratista anterior en una cesión). */
  impactoAutomatico?: string;
}

/**
 * Efecto de una modificación sobre el contrato (files/05 §7). Función pura.
 * Las modificaciones no se editan: si hay error se anulan y se registra una nueva.
 */
export function efectoModificacion(
  c: ContractBase,
  mod: { tipo: string; valorNuevo?: number | null; fechaNueva?: string | null; nuevoTexto?: string | null },
): EfectoModificacion {
  const valorInicial = (c.valorBase ?? 0) + (c.iva ?? 0) + (c.otrosImp ?? 0);
  const valorActual = valorInicial + (c.adiciones ?? 0) - (c.reducciones ?? 0);
  const cambios: CambiosContrato = {};
  let aviso = false;
  let impacto: string | undefined;

  switch (mod.tipo) {
    case 'Adición': {
      // Suma a adiciones la diferencia entre el valor nuevo y el actual.
      if (mod.valorNuevo != null) {
        cambios.adiciones = Math.round((c.adiciones ?? 0) + (mod.valorNuevo - valorActual));
      }
      aviso = true;
      break;
    }
    case 'Reducción': {
      if (mod.valorNuevo != null) {
        cambios.reducciones = Math.round((c.reducciones ?? 0) + (valorActual - mod.valorNuevo));
      }
      break;
    }
    case 'Prórroga': {
      cambios.fechaFin = mod.fechaNueva ?? c.fechaFin;
      // Si estaba terminado vuelve a Activo.
      if (c.estado === 'Terminado') cambios.estado = 'Activo';
      aviso = true;
      break;
    }
    case 'Suspensión': {
      cambios.estado = 'Suspendido';
      break;
    }
    case 'Reinicio': {
      cambios.estado = 'Activo';
      if (mod.fechaNueva) cambios.fechaFin = mod.fechaNueva;
      aviso = true;
      break;
    }
    case 'Cesión': {
      cambios.contratista = mod.nuevoTexto ?? c.contratista ?? undefined;
      impacto = `Cesión de ${c.contratista ?? ''} a ${mod.nuevoTexto ?? ''}`;
      break;
    }
    case 'Modificación de supervisor': {
      cambios.supervisor = mod.nuevoTexto ?? c.supervisor ?? undefined;
      break;
    }
    case 'Terminación anticipada': {
      cambios.fechaFin = mod.fechaNueva ?? c.fechaFin;
      cambios.estado = 'Terminado';
      break;
    }
    // 'Modificación de obligaciones', 'Modificación de condiciones': solo queda registrada.
    default:
      break;
  }

  return { cambios, avisoRevisarPolizas: aviso, impactoAutomatico: impacto };
}
