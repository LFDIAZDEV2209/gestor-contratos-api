import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ActualizarParametrosDto {
  /** Umbrales de alerta en días (por defecto 30,15,10,5,3,1). */
  @IsOptional() @IsArray() @ArrayMinSize(1) @ArrayMaxSize(12) @IsInt({ each: true }) @Min(1, { each: true })
  alertDays?: number[];

  @IsOptional() @IsInt() @Min(1) @Max(60)
  criticalDays?: number;

  @IsOptional() @IsInt() @Min(1) @Max(100)
  budgetPct?: number;

  @IsOptional() @IsInt() @Min(1) @Max(100)
  gapPct?: number;
}

export class ActualizarCatalogoDto {
  @IsArray() @IsString({ each: true })
  valores!: string[];
}
