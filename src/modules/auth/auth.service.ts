import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { UsuarioInfo } from '../../common/decorators';
import { RolesService } from '../roles/roles.service';
import { Permiso } from '../../common/decorators';
import { ApiError } from '../../common/exceptions/api-exception';
import { ReqContext } from '../../common/req-context';
import { AuditService } from '../audit/audit.service';
import { ConfigService } from '@nestjs/config';

export interface TokenRespuesta {
  token: string;
  usuario: UsuarioInfo;
  permisos: Permiso[];
}

/** Login de demostración por correo (el SSO corporativo OIDC se conecta en fase 1). */
@Injectable()
export class AuthService {
  constructor(
    private readonly jwt: JwtService,
    private readonly users: UsersService,
    private readonly roles: RolesService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  async login(email: string, ctx: ReqContext): Promise<TokenRespuesta> {
    // REVISIÓN C01: el login demo no verifica identidad (el email asume el rol).
    // D0004: en producción solo se habilita con autorización explícita por entorno.
    const demoAuth = this.config.get<string>('authDemoLogin') === '1';
    if (this.config.get<string>('nodeEnv') === 'production' && !demoAuth) {
      throw new ApiError(503, 'AUTH_SSO_PENDING', 'Autenticación por SSO corporativo pendiente de conexión (fase 1).');
    }
    const u = await this.users.obtenerPorEmail(email);
    if (!u || u.estado !== 'Activo') {
      throw new ApiError(401, 'UNAUTHENTICATED', 'Credenciales inválidas o usuario inactivo.');
    }
    const token = await this.jwt.signAsync({ sub: u.id, email: u.email });
    const usuario: UsuarioInfo = { id: u.id, nombre: u.nombre, email: u.email, rol: u.rol };
    const permisos = [...(await this.roles.permisosDeRol(u.rol))];
    await this.audit.registrar(ctx, [{ modulo: 'Sistema', accion: 'LOGIN', nuevo: `${u.nombre} (${u.rol})` }]);
    return { token, usuario, permisos };
  }
}
