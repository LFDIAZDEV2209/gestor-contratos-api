import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { RolesService } from '../roles/roles.service';
import { AuditService } from '../audit/audit.service';

describe('AuthService: acceso demo por entorno', () => {
  const usuario = { id: 'U1', nombre: 'Laura Méndez', email: 'lmendez@empresa.co', rol: 'ADMINISTRADOR' };
  const ctx = { usuarioId: 'U1', usuario: usuario.nombre, rol: usuario.rol, ip: '127.0.0.1' };

  function servicio(nodeEnv: string, authDemoLogin?: string, estado = 'Activo') {
    const users = { obtenerPorEmail: jest.fn().mockResolvedValue({ ...usuario, estado }) };
    const jwt = { signAsync: jest.fn().mockResolvedValue('token-demo') };
    const audit = { registrar: jest.fn().mockResolvedValue(undefined) };
    const auth = new AuthService(
      jwt as unknown as JwtService,
      users as unknown as UsersService,
      { permisosDeRol: jest.fn().mockResolvedValue(['VER']) } as unknown as RolesService,
      audit as unknown as AuditService,
      new ConfigService({ nodeEnv, authDemoLogin }),
    );
    return { auth, users, jwt, audit };
  }

  it.each([undefined, '0', 'true', ''])('bloquea producción con AUTH_DEMO_LOGIN=%s', async (flag) => {
    const { auth, users, jwt } = servicio('production', flag);
    await expect(auth.login(usuario.email, ctx)).rejects.toMatchObject({ code: 'AUTH_SSO_PENDING' });
    expect(users.obtenerPorEmail).not.toHaveBeenCalled();
    expect(jwt.signAsync).not.toHaveBeenCalled();
  });

  it.each([['production', '1'], ['development', undefined]])('permite demo en %s con valor %s', async (entorno, flag) => {
    const { auth, audit } = servicio(entorno!, flag);
    await expect(auth.login(usuario.email, ctx)).resolves.toEqual({ token: 'token-demo', usuario, permisos: ['VER'] });
    expect(audit.registrar).toHaveBeenCalledWith(ctx, expect.arrayContaining([expect.objectContaining({ accion: 'LOGIN' })]));
  });

  it('mantiene el rechazo de usuarios inactivos con demo habilitado', async () => {
    const { auth, jwt } = servicio('production', '1', 'Inactivo');
    await expect(auth.login(usuario.email, ctx)).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    expect(jwt.signAsync).not.toHaveBeenCalled();
  });
});
