import { IsEmail, IsIn, IsInt, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ROLES } from '../../common/decorators';

export class CrearUsuarioDto {
  @IsString() @MinLength(3) @MaxLength(120)
  nombre!: string;

  @IsEmail() @MaxLength(160)
  email!: string;

  @IsIn(ROLES as unknown as string[])
  rol!: string;
}

export class ActualizarUsuarioDto {
  @IsOptional() @IsString() @MinLength(3) @MaxLength(120)
  nombre?: string;

  @IsOptional() @IsEmail() @MaxLength(160)
  email?: string;

  @IsOptional() @IsIn(ROLES as unknown as string[])
  rol?: string;

  /** Bloqueo optimista: versión del registro leído por el cliente. */
  @IsInt()
  version!: number;
}

export class AnularDto {
  @IsString() @MinLength(3) @MaxLength(500)
  motivo!: string;
}

export class LoginDto {
  @IsEmail() @MaxLength(160)
  email!: string;
}
