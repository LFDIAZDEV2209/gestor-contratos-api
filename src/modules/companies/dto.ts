import { IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

class EmpresaCampos {
  @IsOptional() @IsString() @MaxLength(200)
  razon?: string;

  @IsOptional() @IsString() @MaxLength(30)
  nit?: string;

  @IsOptional() @IsString()
  tipo?: string;

  @IsOptional() @IsString()
  direccion?: string;

  @IsOptional() @IsString()
  ciudad?: string;

  @IsOptional() @IsString()
  depto?: string;

  @IsOptional() @IsString()
  pais?: string;

  @IsOptional() @IsString()
  rep?: string;

  @IsOptional() @IsString()
  repDoc?: string;

  @IsOptional() @IsString()
  tel?: string;

  @IsOptional() @IsString()
  email?: string;

  @IsOptional() @IsString()
  respInterno?: string;
}

export class ActualizarEmpresaDto extends EmpresaCampos {
  /** Bloqueo optimista. */
  @IsInt() @Min(1)
  version!: number;
}

export class CrearEmpresaDto extends EmpresaCampos {
  @IsString() @MinLength(1) @MaxLength(200)
  declare razon: string;

  @IsString() @MinLength(1) @MaxLength(30)
  declare nit: string;
}
