import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { PUBLIC_METADATA } from '../../common/decorators';
import { ApiError } from '../../common/exceptions/api-exception';
import { UsersService } from '../users/users.service';

/** Guard global de autenticación: Bearer JWT emitido por /auth/login (SSO OIDC en fase 1). */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly users: UsersService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const esPublica = this.reflector.getAllAndOverride<boolean>(PUBLIC_METADATA, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (esPublica) return true;

    const req = ctx.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
      reqUser?: unknown;
    }>();
    const authHeader = req.headers.authorization;
    const header = typeof authHeader === 'string' ? authHeader : undefined;
    if (!header?.startsWith('Bearer ')) {
      throw new ApiError(401, 'UNAUTHENTICATED', 'Token ausente o vencido.');
    }
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string }>(header.slice(7));
      req.reqUser = await this.users.obtenerActivo(payload.sub);
    } catch {
      throw new ApiError(401, 'UNAUTHENTICATED', 'Token ausente o vencido.');
    }
    return true;
  }
}
