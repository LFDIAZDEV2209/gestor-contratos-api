/**
 * DTOs de las colecciones hijas. Patrón: campos base todos opcionales
 * (ActualizarDto) y el DTO de creación estrecha los requeridos (files/02).
 */
import {
  IsBoolean, IsDateString, IsIn, IsInt, IsNumber, IsObject, IsOptional, IsString,
  Max, MaxLength, Min, MinLength,
} from 'class-validator';

const PERIODICIDADES = ['Única', 'Semanal', 'Quincenal', 'Mensual', 'Trimestral', 'Semestral', 'Anual', 'Por entrega', 'Permanente'];
const ESTADOS_SUB = ['Activo', 'Suspendido', 'Terminado', 'Liquidado', 'Anulado'];
const ESTADOS_OBL = ['Pendiente', 'En proceso', 'Cumplida', 'Cumplida parcialmente', 'Vencida', 'Incumplida'];
const ESTADOS_ENT = ['Pendiente', 'En proceso', 'Entregado', 'Aprobado', 'Rechazado', 'Suspendido'];
const ESTADOS_PAGO = ['Pendiente', 'En revisión', 'Aprobado', 'Pagado', 'Rechazado', 'Anulado'];
const ESTADOS_ACTA = ['Borrador acta', 'Firmada', 'Anulada'];
const ESTADOS_RIESGO = ['Abierto', 'Controlado', 'Cerrado'];
const ESTADOS_INC = ['Abierto', 'En análisis', 'En gestión', 'Subsanado', 'Cerrado'];
const ESTADOS_PLAN = ['Abierto', 'En ejecución', 'Cerrado'];
const TRATAMIENTOS = ['Mitigar', 'Transferir', 'Aceptar', 'Evitar'];
const TIPOS_MOD = [
  'Adición', 'Reducción', 'Prórroga', 'Suspensión', 'Reinicio', 'Cesión',
  'Modificación de obligaciones', 'Modificación de supervisor', 'Modificación de condiciones', 'Terminación anticipada',
];

/* ── Subcontratos ─────────────────────────────────────────────────────────── */

class SubcontratoCampos {
  @IsOptional() @IsString() contractId?: string;
  @IsOptional() @IsString() @MaxLength(60) numero?: string;
  @IsOptional() @IsString() contratista?: string;
  @IsOptional() @IsString() nit?: string;
  @IsOptional() @IsString() objeto?: string;
  @IsOptional() @IsNumber() @Min(0) valor?: number;
  @IsOptional() @IsDateString() fechaInicio?: string;
  @IsOptional() @IsDateString() fechaFin?: string;
  @IsOptional() @IsIn(ESTADOS_SUB) estado?: string;
  @IsOptional() @IsNumber() @Min(0) @Max(100) ejecucion?: number;
  @IsOptional() @IsString() responsable?: string;
  @IsOptional() @IsString() documentos?: string;
  @IsOptional() @IsString() riesgos?: string;
  @IsOptional() @IsString() obligaciones?: string;
}

export class ActualizarSubcontratoDto extends SubcontratoCampos {
  @IsInt() @Min(1)
  version!: number;
}

export class CrearSubcontratoDto extends SubcontratoCampos {
  @IsString() @MinLength(1) declare contractId: string;
  @IsString() @MinLength(1) @MaxLength(60) declare numero: string;
  @IsString() @MinLength(1) declare contratista: string;
  @IsString() @MinLength(1) declare nit: string;
  @IsString() @MinLength(1) declare objeto: string;
  @IsNumber() @Min(0) declare valor: number;
  @IsDateString() declare fechaInicio: string;
  @IsDateString() declare fechaFin: string;
}

/* ── Obligaciones ─────────────────────────────────────────────────────────── */

class ObligacionCampos {
  @IsOptional() @IsString() contractId?: string;
  @IsOptional() @IsString() tipo?: string;
  @IsOptional() @IsString() descripcion?: string;
  @IsOptional() @IsString() responsable?: string;
  @IsOptional() @IsDateString() fechaLimite?: string;
  @IsOptional() @IsIn(PERIODICIDADES) periodicidad?: string;
  @IsOptional() @IsString() evidencia?: string;
  @IsOptional() @IsIn(ESTADOS_OBL) estado?: string;
  @IsOptional() @IsNumber() @Min(0) @Max(100) cumplimiento?: number;
  @IsOptional() @IsString() obs?: string;
}

export class ActualizarObligacionDto extends ObligacionCampos {
  @IsInt() @Min(1)
  version!: number;
}

export class CrearObligacionDto extends ObligacionCampos {
  @IsString() @MinLength(1) declare contractId: string;
  @IsString() @MinLength(1) declare descripcion: string;
  @IsString() @MinLength(1) declare responsable: string;
  @IsDateString() declare fechaLimite: string;
}

export class ItemChecklistDto {
  @IsString() @MinLength(1) @MaxLength(500)
  texto!: string;

  @IsOptional() @IsInt() @Min(0)
  orden?: number;
}

export class ToggleChecklistDto {
  @IsBoolean()
  hecho!: boolean;
}

export class ComentarioDto {
  @IsString() @MinLength(1) @MaxLength(2000)
  texto!: string;
}

export class VerificarObligacionDto {
  @IsIn(['Cumplida', 'Cumplida parcialmente'])
  estado!: string;

  @IsOptional() @IsString() @MaxLength(2000)
  obs?: string;
}

/* ── Entregables ──────────────────────────────────────────────────────────── */

class EntregableCampos {
  @IsOptional() @IsString() contractId?: string;
  @IsOptional() @IsString() nombre?: string;
  @IsOptional() @IsString() descripcion?: string;
  @IsOptional() @IsDateString() fechaInicio?: string;
  @IsOptional() @IsDateString() fechaProg?: string;
  @IsOptional() @IsDateString() fechaReal?: string;
  @IsOptional() @IsString() responsable?: string;
  @IsOptional() @IsIn(ESTADOS_ENT) estado?: string;
  @IsOptional() @IsNumber() @Min(0) @Max(100) avance?: number;
  @IsOptional() @IsString() evidencia?: string;
  @IsOptional() @IsString() obs?: string;
}

export class ActualizarEntregableDto extends EntregableCampos {
  @IsInt() @Min(1)
  version!: number;
}

export class CrearEntregableDto extends EntregableCampos {
  @IsString() @MinLength(1) declare contractId: string;
  @IsString() @MinLength(1) declare nombre: string;
  @IsDateString() declare fechaInicio: string;
  @IsDateString() declare fechaProg: string;
}

/* ── Ejecución mensual ────────────────────────────────────────────────────── */

class EjecucionCampos {
  @IsOptional() @IsString() contractId?: string;
  @IsOptional() @IsString() @MinLength(7) @MaxLength(7) periodo?: string;
  @IsOptional() @IsNumber() @Min(0) valor?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) avanceFisico?: number;
  @IsOptional() @IsString() obs?: string;
}

export class ActualizarEjecucionDto extends EjecucionCampos {
  @IsInt() @Min(1)
  version!: number;
}

export class CrearEjecucionDto extends EjecucionCampos {
  @IsString() @MinLength(1) declare contractId: string;
  @IsString() @MinLength(7) @MaxLength(7) declare periodo: string;
  @IsNumber() @Min(0) declare valor: number;
  @IsNumber() @Min(0) @Max(100) declare avanceFisico: number;
}

/* ── Pagos ────────────────────────────────────────────────────────────────── */

class PagoCampos {
  @IsOptional() @IsString() contractId?: string;
  @IsOptional() @IsString() @MaxLength(60) numero?: string;
  @IsOptional() @IsDateString() fecha?: string;
  @IsOptional() @IsString() factura?: string;
  @IsOptional() @IsString() @MinLength(7) @MaxLength(7) periodo?: string;
  @IsOptional() @IsNumber() @Min(0) bruto?: number;
  @IsOptional() @IsNumber() @Min(0) iva?: number;
  @IsOptional() @IsNumber() @Min(0) retenciones?: number;
  @IsOptional() @IsIn(ESTADOS_PAGO) estado?: string;
  @IsOptional() @IsDateString() fechaAprob?: string;
  @IsOptional() @IsDateString() fechaPago?: string;
  @IsOptional() @IsString() soporte?: string;
}

export class ActualizarPagoDto extends PagoCampos {
  @IsInt() @Min(1)
  version!: number;
}

export class CrearPagoDto extends PagoCampos {
  @IsString() @MinLength(1) declare contractId: string;
  @IsString() @MinLength(1) @MaxLength(60) declare numero: string;
  @IsDateString() declare fecha: string;
  @IsString() @MinLength(1) declare factura: string;
  @IsNumber() @Min(0) declare bruto: number;
}

/* ── Actas ────────────────────────────────────────────────────────────────── */

class ActaCampos {
  @IsOptional() @IsString() contractId?: string;
  @IsOptional() @IsString() @MaxLength(60) numero?: string;
  @IsOptional() @IsString() tipo?: string;
  @IsOptional() @IsDateString() fecha?: string;
  @IsOptional() @IsNumber() @Min(0) valor?: number;
  @IsOptional() @IsString() descripcion?: string;
  @IsOptional() @IsString() archivo?: string;
  @IsOptional() @IsString() responsable?: string;
  @IsOptional() @IsIn(ESTADOS_ACTA) estado?: string;
}

export class ActualizarActaDto extends ActaCampos {
  @IsInt() @Min(1)
  version!: number;
}

export class CrearActaDto extends ActaCampos {
  @IsString() @MinLength(1) declare contractId: string;
  @IsString() @MinLength(1) @MaxLength(60) declare numero: string;
  @IsString() @MinLength(1) declare tipo: string;
  @IsDateString() declare fecha: string;
  @IsString() @MinLength(1) declare descripcion: string;
}

/* ── Modificaciones (inmutables: solo crear/anular) ───────────────────────── */

export class CrearModificacionDto {
  @IsString() @MinLength(1)
  contractId!: string;

  @IsString() @MinLength(1) @MaxLength(60)
  numero!: string;

  @IsIn(TIPOS_MOD)
  tipo!: string;

  @IsDateString()
  fecha!: string;

  @IsOptional() @IsString()
  soporte?: string;

  @IsString() @MinLength(1) @MaxLength(4000)
  justificacion!: string;

  @IsOptional() @IsNumber() @Min(0)
  valorAnterior?: number;

  @IsOptional() @IsNumber() @Min(0)
  valorNuevo?: number;

  @IsOptional() @IsString()
  nuevoTexto?: string;

  @IsOptional() @IsDateString()
  fechaAnterior?: string;

  @IsOptional() @IsDateString()
  fechaNueva?: string;

  @IsOptional() @IsString() @MaxLength(4000)
  impacto?: string;
}

/* ── Riesgos ──────────────────────────────────────────────────────────────── */

class RiesgoCampos {
  @IsOptional() @IsString() contractId?: string;
  @IsOptional() @IsString() categoria?: string;
  @IsOptional() @IsString() riesgo?: string;
  @IsOptional() @IsInt() @Min(1) @Max(5) prob?: number;
  @IsOptional() @IsInt() @Min(1) @Max(5) impacto?: number;
  @IsOptional() @IsString() responsable?: string;
  @IsOptional() @IsIn(TRATAMIENTOS) tratamiento?: string;
  @IsOptional() @IsDateString() fecha?: string;
  @IsOptional() @IsIn(ESTADOS_RIESGO) estado?: string;
  @IsOptional() @IsString() mitigacion?: string;
  @IsOptional() @IsString() evidencia?: string;
}

export class ActualizarRiesgoDto extends RiesgoCampos {
  @IsInt() @Min(1)
  version!: number;
}

export class CrearRiesgoDto extends RiesgoCampos {
  @IsString() @MinLength(1) declare contractId: string;
  @IsString() @MinLength(1) declare riesgo: string;
  @IsInt() @Min(1) @Max(5) declare prob: number;
  @IsInt() @Min(1) @Max(5) declare impacto: number;
}

/* ── Incumplimientos ──────────────────────────────────────────────────────── */

class IncumplimientoCampos {
  @IsOptional() @IsString() contractId?: string;
  @IsOptional() @IsDateString() fecha?: string;
  @IsOptional() @IsString() obligationId?: string;
  @IsOptional() @IsString() tipo?: string;
  @IsOptional() @IsString() descripcion?: string;
  @IsOptional() @IsString() responsable?: string;
  @IsOptional() @IsIn(['Bajo', 'Medio', 'Alto']) impacto?: string;
  @IsOptional() @IsIn(ESTADOS_INC) estado?: string;
  @IsOptional() @IsString() plan?: string;
  @IsOptional() @IsDateString() fechaLimite?: string;
  @IsOptional() @IsString() medida?: string;
  @IsOptional() @IsNumber() @Min(0) multa?: number;
  @IsOptional() @IsString() evidencia?: string;
}

export class ActualizarIncumplimientoDto extends IncumplimientoCampos {
  @IsInt() @Min(1)
  version!: number;
}

export class CrearIncumplimientoDto extends IncumplimientoCampos {
  @IsString() @MinLength(1) declare contractId: string;
  @IsDateString() declare fecha: string;
  @IsString() @MinLength(1) declare tipo: string;
  @IsString() @MinLength(1) declare descripcion: string;
}

/* ── Planes de mejoramiento ───────────────────────────────────────────────── */

class PlanCampos {
  @IsOptional() @IsString() contractId?: string;
  @IsOptional() @IsDateString() fecha?: string;
  @IsOptional() @IsString() hallazgo?: string;
  @IsOptional() @IsString() causa?: string;
  @IsOptional() @IsString() accion?: string;
  @IsOptional() @IsString() responsable?: string;
  @IsOptional() @IsIn(ESTADOS_PLAN) estado?: string;
  @IsOptional() @IsNumber() @Min(0) @Max(100) avance?: number;
  @IsOptional() @IsString() evidencia?: string;
}

export class ActualizarPlanDto extends PlanCampos {
  @IsInt() @Min(1)
  version!: number;
}

export class CrearPlanDto extends PlanCampos {
  @IsString() @MinLength(1) declare contractId: string;
  @IsDateString() declare fecha: string;
  @IsString() @MinLength(1) declare hallazgo: string;
  @IsString() @MinLength(1) declare accion: string;
}

/* ── Documentos ───────────────────────────────────────────────────────────── */

export class CrearDocumentoDto {
  @IsString() @MinLength(1)
  contractId!: string;

  @IsString() @MinLength(1) @MaxLength(200)
  nombre!: string;

  @IsString() @MinLength(1)
  categoria!: string;

  @IsOptional() @IsString() @MaxLength(2000)
  obs?: string;

  /** Datos extraídos iniciales (solo categoría «Contrato»). */
  @IsOptional() @IsObject()
  extracted?: Record<string, unknown>;
}

export class ActualizarExtraidosDto {
  @IsObject()
  extracted!: Record<string, unknown>;

  @IsInt() @Min(1)
  version!: number;
}

export class NuevaVersionDto {
  @IsString() @MinLength(3) @MaxLength(500)
  motivo!: string;

  @IsOptional() @IsString() @MaxLength(2000)
  cambios?: string;
}

/* ── Alertas y tareas ─────────────────────────────────────────────────────── */

export class CrearTareaDto {
  @IsString() @MinLength(1) @MaxLength(200)
  titulo!: string;

  @IsString() @MinLength(1)
  asignado!: string;

  @IsOptional() @IsDateString()
  vence?: string;
}

export class ActualizarTareaDto {
  @IsOptional() @IsIn(['Abierta', 'Cerrada'])
  estado?: string;

  @IsInt() @Min(1)
  version!: number;
}

export class DelegarAlertaDto {
  @IsString() @MinLength(1)
  usuarioId!: string;
}

export class ResolverAlertaDto {
  @IsString() @MinLength(1) @MaxLength(2000)
  nota!: string;
}

