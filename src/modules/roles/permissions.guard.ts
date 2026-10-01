import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ADMIN_METADATA, PERM_METADATA, Permiso } from '../../common/decorators';
import { ApiError } from '../../common/exceptions/api-exception';
import { RolesService } from './roles.service';

/**
 * Guard global: valida primero si la ruta es exclusiva del ADMINISTRADOR
 * (configuración, catálogos, usuarios, permisos) y luego el permiso
 * de la matriz rol × permiso de files/08.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly roles: RolesService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<{ reqUser?: { rol: string } }>();

    const soloAdmin = this.reflector.getAllAndOverride<boolean>(ADMIN_METADATA, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    const permiso = this.reflector.getAllAndOverride<Permiso | undefined>(PERM_METADATA, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    // Rutas sin restricción pasan directo (incluidas las públicas).
    if (!soloAdmin && !permiso) return true;

    const rol = req.reqUser?.rol;
    if (!rol) return false;

    if (soloAdmin && rol !== 'ADMINISTRADOR') {
      throw new ApiError(403, 'FORBIDDEN', 'Solo el ADMINISTRADOR puede realizar esta acción.');
    }
    if (!permiso) return true;
    if (rol === 'ADMINISTRADOR') return true;
    const ok = await this.roles.tienePermiso(rol, permiso);
    if (!ok) {
      throw new ApiError(403, 'FORBIDDEN', `El rol ${rol} no tiene el permiso ${permiso}.`);
    }
    return true;
  }
}
