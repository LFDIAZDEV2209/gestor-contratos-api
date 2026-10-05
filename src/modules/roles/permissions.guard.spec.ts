import { PermissionsGuard } from './permissions.guard';
import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';
import { ApiError } from '../../common/exceptions/api-exception';
import { ADMIN_METADATA, PERM_METADATA } from '../../common/decorators';
import { mockRolesService } from '../../../test/mocks';

function createMockContext(req: any = {}): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => ({}),
      getNext: () => ({}),
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe('PermissionsGuard (RBAC por rol y permiso)', () => {
  let guard: PermissionsGuard;
  let reflector: jest.Mocked<Reflector>;
  let rolesService: ReturnType<typeof mockRolesService>;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as any;
    rolesService = mockRolesService();
    guard = new PermissionsGuard(reflector, rolesService as any);
  });

  it('permite acceso si la ruta no tiene @SoloAdmin ni @RequierePermiso (ruta sin restricción)', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined); // ni soloAdmin ni permiso
    const ctx = createMockContext({ reqUser: { rol: 'CONSULTA' } });

    const puede = await guard.canActivate(ctx);
    expect(puede).toBe(true);
  });

  it('deniega acceso retornando false si la ruta tiene restricción pero no hay reqUser o rol', async () => {
    reflector.getAllAndOverride.mockImplementation((key: any) => {
      if (key === ADMIN_METADATA) return true;
      return undefined;
    });
    const ctx = createMockContext({}); // Sin reqUser

    const puede = await guard.canActivate(ctx);
    expect(puede).toBe(false);
  });

  describe('@SoloAdmin', () => {
    beforeEach(() => {
      reflector.getAllAndOverride.mockImplementation((key: any) => {
        if (key === ADMIN_METADATA) return true;
        return undefined;
      });
    });

    it('permite acceso a usuario con rol ADMINISTRADOR', async () => {
      const ctx = createMockContext({ reqUser: { rol: 'ADMINISTRADOR' } });
      const puede = await guard.canActivate(ctx);
      expect(puede).toBe(true);
    });

    it('lanza ApiError (403 FORBIDDEN) si el rol no es ADMINISTRADOR', async () => {
      const ctx = createMockContext({ reqUser: { rol: 'CONTRATACIÓN' } });
      await expect(guard.canActivate(ctx)).rejects.toThrow(ApiError);
    });
  });

  describe('@RequierePermiso', () => {
    beforeEach(() => {
      reflector.getAllAndOverride.mockImplementation((key: any) => {
        if (key === PERM_METADATA) return 'CREAR';
        return undefined;
      });
    });

    it('permite acceso inmediato a ADMINISTRADOR sin consultar matriz', async () => {
      const ctx = createMockContext({ reqUser: { rol: 'ADMINISTRADOR' } });
      const puede = await guard.canActivate(ctx);
      expect(puede).toBe(true);
      expect(rolesService.tienePermiso).not.toHaveBeenCalled();
    });

    it('permite acceso si rolesService.tienePermiso es true', async () => {
      rolesService.tienePermiso.mockResolvedValueOnce(true);
      const ctx = createMockContext({ reqUser: { rol: 'CONTRATACIÓN' } });

      const puede = await guard.canActivate(ctx);
      expect(puede).toBe(true);
      expect(rolesService.tienePermiso).toHaveBeenCalledWith('CONTRATACIÓN', 'CREAR');
    });

    it('lanza ApiError (403 FORBIDDEN) si rolesService.tienePermiso es false', async () => {
      rolesService.tienePermiso.mockResolvedValueOnce(false);
      const ctx = createMockContext({ reqUser: { rol: 'CONSULTA' } });

      await expect(guard.canActivate(ctx)).rejects.toThrow(ApiError);
      expect(rolesService.tienePermiso).toHaveBeenCalledWith('CONSULTA', 'CREAR');
    });
  });
});
