import { Repository, DataSource, EntityManager, ObjectLiteral } from 'typeorm';
import { ReqContext } from '../src/common/req-context';

export function createMockRepo<T extends ObjectLiteral = any>(overrides: Partial<Record<keyof Repository<T>, any>> = {}) {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    findOneOrFail: jest.fn().mockResolvedValue(null),
    create: jest.fn((dto: any) => ({ ...dto })),
    save: jest.fn((entity: any) => Promise.resolve({ id: 'ID-1', ...entity })),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    delete: jest.fn().mockResolvedValue({ affected: 1 }),
    insert: jest.fn().mockResolvedValue({ identifiers: [{ id: 'ID-1' }] }),
    upsert: jest.fn().mockResolvedValue({ identifiers: [{ id: 'ID-1' }] }),
    count: jest.fn().mockResolvedValue(0),
    createQueryBuilder: jest.fn(() => ({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    })),
    ...overrides,
  } as unknown as jest.Mocked<Repository<T>>;
}

export function mockReqContext(overrides: Partial<ReqContext> = {}): ReqContext {
  return {
    usuario: 'Luis Méndez',
    usuarioId: 'USR-01',
    rol: 'ADMINISTRADOR',
    ip: '127.0.0.1',
    ...overrides,
  };
}

export function mockAuditService() {
  return {
    registrar: jest.fn().mockResolvedValue(undefined),
    registrarEn: jest.fn().mockResolvedValue(undefined),
  };
}

export function mockSettingsService() {
  return {
    parametros: jest.fn().mockResolvedValue({
      alertDays: [30, 15, 10, 5, 3, 1],
      criticalDays: 5,
      budgetPct: 90,
      gapPct: 15,
    }),
  };
}

export function mockRolesService() {
  return {
    tienePermiso: jest.fn().mockResolvedValue(true),
  };
}

export function mockDataSource() {
  const emRepo = createMockRepo();
  const mockEm = {
    getRepository: jest.fn(() => emRepo),
  } as unknown as EntityManager;

  return {
    transaction: jest.fn(async (cb: (em: EntityManager) => Promise<any>) => cb(mockEm)),
    emRepo,
  } as unknown as { transaction: jest.Mock; emRepo: ReturnType<typeof createMockRepo> } & DataSource;
}
