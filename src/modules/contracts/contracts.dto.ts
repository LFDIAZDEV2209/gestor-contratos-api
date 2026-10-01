import { Type } from 'class-transformer';
import {
  IsArray, IsBoolean, IsDateString, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength,
} from 'class-validator';

export class CrearContratoDto {
  @IsString() @MinLength(1) @MaxLength(60)
  numero!: string;

  @IsString() @MinLength(1)
  tipo!: string;

  @IsOptional() @IsString()
  modalidad?: string;

  @IsString() @MinLength(1)
  companyId!: string;

  @IsOptional() @IsString()
  estado?: string;

  @IsString() @MinLength(1)
  contratista!: string;

  @IsString() @MinLength(1)
  nitContratista!: string;

  @IsOptional() @IsString()
  repContratista?: string;

  @IsOptional() @IsString()
  area?: string;

  @IsString() @MinLength(1)
  objeto!: string;

  @IsOptional() @IsString()
  descripcion?: string;

  @IsString() @MinLength(1)
  responsable!: string;

  @IsString() @MinLength(1)
  supervisor!: string;

  @IsOptional() @IsString()
  interventor?: string;

  @IsOptional() @IsArray() @IsString({ each: true })
  deptos?: string[];

  @IsOptional() @IsString()
  municipio?: string;

  @IsOptional() @IsDateString()
  fechaFirma?: string;

  @IsDateString()
  fechaInicio!: string;

  @IsDateString()
  fechaFin!: string;

  @IsOptional() @IsBoolean()
  hastaAgotar?: boolean;

  @IsNumber() @Min(0)
  valorBase!: number;

  @IsOptional() @IsNumber() @Min(0)
  iva?: number;

  @IsOptional() @IsNumber() @Min(0)
  otrosImp?: number;

  @IsOptional() @IsNumber() @Min(0)
  adiciones?: number;

  @IsOptional() @IsNumber() @Min(0)
  reducciones?: number;

  @IsOptional() @IsNumber() @Min(0) @Max(100)
  avanceFisico?: number;

  @IsOptional() @IsString()
  alcance?: string;

  @IsOptional() @IsString()
  productos?: string;

  @IsOptional() @IsString()
  indicadores?: string;
}

export class ActualizarContratoDto extends CrearContratoDto {
  @IsInt() @Min(1)
  version!: number;
}

export class ValidarContratoDto {
  /** Advertencias aceptables (Media/Baja) se confirman con force=true. */
  @IsOptional() @IsBoolean()
  force?: boolean;
}

export class FiltrosContratos {
  q?: string;
  companyId?: string;
  estado?: string;
  tipo?: string;
  anio?: number;
  responsable?: string;
  supervisor?: string;
  depto?: string;
  region?: string;
  aseguradora?: string;
  /** Semáforo: normal | atencion | riesgo | critico | info */
  nivel?: string;
  vencidos?: boolean;
  /** Ventana en días para «próximos a vencer». */
  proximos?: number;
  conIncumplimientos?: boolean;
  garantiasVencidas?: boolean;
  multiAseguradoras?: boolean;
  incluirAnulados?: boolean;
  page?: number;
  pageSize?: number;
}

export interface ConsultaContratosDto extends FiltrosContratos {}

export class RectificarExtraidosDto {
  @Type(() => Object)
  extracted!: Record<string, unknown>;
}
