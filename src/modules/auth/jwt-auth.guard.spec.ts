import { JwtAuthGuard } from './jwt-auth.guard';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ExecutionContext } from '@nestjs/common';
import { ApiError } from '../../common/exceptions/api-exception';
import { PUBLIC_METADATA } from '../../common/decorators';

function createMockContext(headers: Record<string, string | undefined> = {}): { ctx: ExecutionContext; req: any } {
  const req: any = { headers };
  const ctx = {
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => ({}),
      getNext: () => ({}),
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
  return { ctx, req };
}

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: jest.Mocked<Reflector>;
  let jwt: jest.Mocked<JwtService>;
  let users: any;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as any;
    jwt = {
      verifyAsync: jest.fn(),
    } as any;
    users = {
      obtenerActivo: jest.fn(),
    };
    guard = new JwtAuthGuard(reflector, jwt, users);
  });

  it('permite acceso si la ruta es pública (@Public)', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    const { ctx } = createMockContext();

    const ok = await guard.canActivate(ctx);

    expect(ok).toBe(true);
    expect(jwt.verifyAsync).not.toHaveBeenCalled();
  });

  it('lanza ApiError (401 UNAUTHENTICATED) si no se envía cabecera Authorization', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    const { ctx } = createMockContext({});

    await expect(guard.canActivate(ctx)).rejects.toThrow(ApiError);
  });

  it('lanza ApiError (401 UNAUTHENTICATED) si la cabecera no empieza por Bearer', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    const { ctx } = createMockContext({ authorization: 'Basic 12345' });

    await expect(guard.canActivate(ctx)).rejects.toThrow(ApiError);
  });

  it('lanza ApiError (401 UNAUTHENTICATED) si jwt.verifyAsync falla (token expirado o inválido)', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    const { ctx } = createMockContext({ authorization: 'Bearer token_invalido' });
    jwt.verifyAsync.mockRejectedValueOnce(new Error('jwt expired'));

    await expect(guard.canActivate(ctx)).rejects.toThrow(ApiError);
  });

  it('lanza ApiError (401 UNAUTHENTICATED) si el usuario asociado al token no está activo', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    const { ctx } = createMockContext({ authorization: 'Bearer token_valido' });
    jwt.verifyAsync.mockResolvedValueOnce({ sub: 'USR-INACTIVO' });
    users.obtenerActivo.mockRejectedValueOnce(new Error('Usuario inactivo'));

    await expect(guard.canActivate(ctx)).rejects.toThrow(ApiError);
  });

  it('valida el token, coloca reqUser en la request y permite acceso', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    const { ctx, req } = createMockContext({ authorization: 'Bearer token_valido' });
    jwt.verifyAsync.mockResolvedValueOnce({ sub: 'USR-01' });
    const usuarioActivo = { id: 'USR-01', nombre: 'Luis Méndez', rol: 'ADMINISTRADOR', estado: 'Activo' };
    users.obtenerActivo.mockResolvedValueOnce(usuarioActivo);

    const ok = await guard.canActivate(ctx);

    expect(ok).toBe(true);
    expect(jwt.verifyAsync).toHaveBeenCalledWith('token_valido');
    expect(users.obtenerActivo).toHaveBeenCalledWith('USR-01');
    expect(req.reqUser).toEqual(usuarioActivo);
  });
});
