const redis = {
  on: jest.fn(), connect: jest.fn().mockResolvedValue(undefined), get: jest.fn(), set: jest.fn(),
  del: jest.fn(), scan: jest.fn(), ping: jest.fn().mockResolvedValue('PONG'), quit: jest.fn(),
};

jest.mock('ioredis', () => ({ __esModule: true, default: jest.fn(() => redis) }), { virtual: true });

import { ValkeyCacheService } from './valkey-cache.service';

describe('ValkeyCacheService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('uses the environment namespace and parses JSON values', async () => {
    redis.get.mockResolvedValueOnce('{"id":1}');
    const cache = new ValkeyCacheService({ host: 'valkey', port: 6379, tls: false, defaultTtl: 60, nodeEnv: 'production' });

    await expect(cache.get<{ id: number }>('reports:r_general')).resolves.toEqual({ id: 1 });
    expect(redis.get).toHaveBeenCalledWith('nexogc:prod:reports:r_general');
    await expect(cache.ping()).resolves.toBe(true);
  });

  it('uses SCAN rather than KEYS for pattern invalidation', async () => {
    redis.scan.mockResolvedValueOnce(['0', ['nexogc:dev:settings:a', 'nexogc:dev:settings:b']]);
    redis.del.mockResolvedValueOnce(2);
    const cache = new ValkeyCacheService({ host: 'valkey', port: 6379, tls: false, defaultTtl: 60, nodeEnv: 'development' });

    await expect(cache.delByPattern('settings:*')).resolves.toBe(2);
    expect(redis.scan).toHaveBeenCalledWith('0', 'MATCH', 'nexogc:dev:settings:*', 'COUNT', '100');
  });
});
