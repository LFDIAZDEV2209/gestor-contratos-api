import { IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

const MODALIDADES = ['Póliza individual', 'Póliza por cupo'];
const ESTADOS_GAR = ['Pendiente', 'Aprobada', 'Rechazada', 'Anulada'];
const ESTADOS_CUPO = ['Vigente', 'Suspendido', 'Vencido', 'Anulado'];

class GarantiaCampos {
  @IsOptional() @IsString() contractId?: string;
  @IsOptional() @IsString() tipo?: string;
  @IsOptional() @IsString() aseguradora?: string;
  @IsOptional() @IsString() @MaxLength(60) poliza?: string;
  @IsOptional() @IsIn(MODALIDADES) modalidadPoliza?: string;
  @IsOptional() @IsString() cupoId?: string;
  @IsOptional() @IsNumber() @Min(0) @Max(100) porcentaje?: number;
  @IsOptional() @IsString() tomador?: string;
  @IsOptional() @IsString() intermediario?: string;
  @IsOptional() @IsNumber() @Min(0) prima?: number;
  @IsOptional() @IsNumber() @Min(0) valor?: number;
  @IsOptional() @IsDateString() fechaExp?: string;
  @IsOptional() @IsDateString() fechaInicio?: string;
  @IsOptional() @IsDateString() fechaVenc?: string;
  @IsOptional() @IsIn(ESTADOS_GAR) estado?: string;
  @IsOptional() @IsString() documento?: string;
  @IsOptional() @IsString() relacion?: string;
}

export class ActualizarGarantiaDto extends GarantiaCampos {
  @IsInt() @Min(1)
  version!: number;
}

export class CrearGarantiaDto extends GarantiaCampos {
  @IsString() @MinLength(1) declare contractId: string;
  @IsString() @MinLength(1) declare tipo: string;
  @IsString() @MinLength(1) declare aseguradora: string;
  @IsString() @MinLength(1) @MaxLength(60) declare poliza: string;
  @IsNumber() @Min(0) declare valor: number;
  @IsDateString() declare fechaInicio: string;
  @IsDateString() declare fechaVenc: string;
}

class CupoCampos {
  @IsOptional() @IsString() aseguradora?: string;
  @IsOptional() @IsString() @MaxLength(60) numero?: string;
  @IsOptional() @IsString() tomador?: string;
  @IsOptional() @IsString() intermediario?: string;
  @IsOptional() @IsNumber() @Min(0) valor?: number;
  @IsOptional() @IsDateString() fechaInicio?: string;
  @IsOptional() @IsDateString() fechaVenc?: string;
  @IsOptional() @IsIn(ESTADOS_CUPO) estado?: string;
  @IsOptional() @IsString() @MaxLength(2000) observaciones?: string;
}

export class ActualizarCupoDto extends CupoCampos {
  @IsInt() @Min(1)
  version!: number;
}

export class CrearCupoDto extends CupoCampos {
  @IsString() @MinLength(1) declare aseguradora: string;
  @IsString() @MinLength(1) @MaxLength(60) declare numero: string;
  @IsString() @MinLength(1) declare tomador: string;
  @IsNumber() @Min(0) declare valor: number;
  @IsDateString() declare fechaInicio: string;
  @IsDateString() declare fechaVenc: string;
}
