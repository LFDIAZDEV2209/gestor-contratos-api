import { SetMetadata, createParamDecorator, ExecutionContext } from '@nestjs/common';

/** Permisos de files/08. */
export type Permiso = 'VER' | 'CREAR' | 'EDITAR' | 'APROBAR' | 'ANULAR' | 'EXPORTAR' | 'AUDITAR';
export const PERMISOS: Permiso[] = ['VER', 'CREAR', 'EDITAR', 'APROBAR', 'ANULAR', 'EXPORTAR', 'AUDITAR'];
export const ROLES = [
  'ADMINISTRADOR',
  'CONTRATACIÓN',
  'JURÍDICA',
  'FINANCIERA',
  'SUPERVISOR',
  'INTERVENTOR',
  'AUDITOR',
  'CONSULTA',
] as const;

const PERM_KEY = 'permisoRequerido';

/** Marca el permiso requerido por la ruta (matriz de files/08, validada en el guard). */
export const Perm = (permiso: Permiso): MethodDecorator & ClassDecorator =>
  SetMetadata(PERM_KEY, permiso);

export const PERM_METADATA = PERM_KEY;

const IS_PUBLIC_KEY = 'esPublica';

/** Rutas sin autenticación (login, salud, docs). */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);
export const PUBLIC_METADATA = IS_PUBLIC_KEY;

const ADMIN_KEY = 'soloAdministrador';

/** Ruta exclusiva del ADMINISTRADOR (configuración, catálogos, usuarios, permisos). */
export const Admin = (): MethodDecorator & ClassDecorator => SetMetadata(ADMIN_KEY, true);
export const ADMIN_METADATA = ADMIN_KEY;

export interface UsuarioInfo {
  id: string;
  nombre: string;
  email: string;
  rol: string;
}

/** Inyecta el usuario autenticado (colocado por JwtAuthGuard). */
export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): UsuarioInfo => ctx.switchToHttp().getRequest().reqUser,
);
