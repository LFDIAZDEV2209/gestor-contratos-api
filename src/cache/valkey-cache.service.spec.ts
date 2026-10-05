const redis = {
  status: 'ready',
  on: jest.fn(), connect: jest.fn(), get: jest.fn(), set: jest.fn(),
  del: jest.fn(), scan: jest.fn(), ping: jest.fn(), quit: jest.fn(),
  disconnect: jest.fn(), incr: jest.fn(), eval: jest.fn(),
};
jest.mock('ioredis', () => ({ __esModule: true, default: function () { return redis; } }), { virtual: true });

import { Logger } from '@nestjs/common';
import { ValkeyCacheService } from './valkey-cache.service';

const createCache = () => new ValkeyCacheService({
  host: 'valkey', port: 6379, tls: false, defaultTtl: 60, nodeEnv: 'production',
});
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
};

describe('ValkeyCacheService', () => {
  let store: Map<string, string>;
  let warning: jest.SpyInstance;

  beforeEach(() => {
    jest.resetAllMocks();
    store = new Map();
    redis.status = 'ready';
    redis.connect.mockResolvedValue(undefined);
    redis.ping.mockResolvedValue('PONG');
    redis.get.mockImplementation(async (key: string) => store.get(key) ?? null);
    redis.set.mockImplementation(async (key: string, value: string) => {
      if (store.has(key)) return null;
      store.set(key, value);
      return 'OK';
    });
    redis.incr.mockImplementation(async (key: string) => {
      const next = Number(store.get(key) ?? 0) + 1;
      store.set(key, String(next));
      return next;
    });
    redis.scan.mockImplementation(async (_cursor: string, _match: string, pattern: string) =>
      ['0', [...store.keys()].filter((key) => key.startsWith(pattern.slice(0, -1)))]);
    redis.del.mockImplementation(async (...keys: string[]) => keys.reduce((count, key) => count + Number(store.delete(key)), 0));
    redis.eval.mockImplementation(async (_script: string, count: number, ...args: (string | number)[]) => {
      if (count === 2) {
        const [generationKey, dataKey, generation, value] = args as string[];
        if ((store.get(generationKey) ?? '0') !== generation) return 0;
        store.set(dataKey, value);
        return 1;
      }
      const [lockKey, token] = args as string[];
      return store.get(lockKey) === token ? Number(store.delete(lockKey)) : 0;
    });
    warning = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

  it('uses environment namespace, generations and JSON values', async () => {
    store.set('nexogc:prod:reports:r_general:g:0', '{"id":1}');
    const cache = createCache();
    await expect(cache.get('reports:r_general')).resolves.toEqual({ id: 1 });
    expect(redis.get).toHaveBeenCalledWith('nexogc:prod:reports:r_general:g:0');
    await expect(cache.ping()).resolves.toBe(true);
  });

  it('increments a persistent family generation and scans data only', async () => {
    store.set('nexogc:prod:settings:a:g:0', '1');
    store.set('nexogc:prod:settings:b:g:0', '2');
    const cache = createCache();
    await expect(cache.delByPattern('settings:*')).resolves.toBe(2);
    expect(redis.scan).toHaveBeenCalledWith('0', 'MATCH', 'nexogc:prod:settings:*', 'COUNT', '100');
    expect(store.get('nexogc:prod:_generation:settings')).toBe('1');
  });

  it('falls back to single-flight if lock acquisition fails and preserves factory errors', async () => {
    redis.set.mockRejectedValue(new Error('AUTH failure'));
    const cache = createCache();
    const factory = jest.fn(async () => 42);
    await expect(Promise.all([cache.wrap('geo:all', factory), cache.wrap('geo:all', factory)])).resolves.toEqual([42, 42]);
    expect(factory).toHaveBeenCalledTimes(1);
    expect(warning).toHaveBeenCalled();
    const error = new Error('database failure');
    await expect(cache.wrap('geo:all', async () => { throw error; })).rejects.toBe(error);
    expect(redis.eval).not.toHaveBeenCalled();
  });

  it('falls back during connection failure without swallowing a factory rejection', async () => {
    redis.status = 'end';
    redis.connect.mockRejectedValue(new Error('disconnected'));
    const cache = createCache();
    const factory = jest.fn(async () => 7);
    await expect(Promise.all([cache.wrap('reports:a', factory), cache.wrap('reports:a', factory)])).resolves.toEqual([7, 7]);
    expect(factory).toHaveBeenCalledTimes(1);
    await expect(cache.ping()).resolves.toBe(false);
  });

  it('waits at most five seconds for another lock holder', async () => {
    jest.useFakeTimers();
    redis.set.mockResolvedValue(null);
    const cache = createCache();
    const factory = jest.fn(async () => 'fresh');
    const pending = cache.wrap('geo:all', factory);
    await jest.advanceTimersByTimeAsync(4_999);
    expect(factory).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1);
    await expect(pending).resolves.toBe('fresh');
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('bounds a stalled lock command and continues with the factory', async () => {
    jest.useFakeTimers();
    redis.set.mockImplementation(() => new Promise(() => undefined));
    const pending = createCache().wrap('geo:all', async () => 'available');
    await jest.advanceTimersByTimeAsync(5_000);
    await expect(pending).resolves.toBe('available');
    expect(warning).toHaveBeenCalled();
  });

  it('shares concurrent successful computations and publishes with jitter', async () => {
    const factory = jest.fn(async () => ({ total: 1 }));
    const cache = createCache();
    await expect(Promise.all([cache.wrap('geo:all', factory, 100), cache.wrap('geo:all', factory, 100)])).resolves.toEqual([{ total: 1 }, { total: 1 }]);
    expect(factory).toHaveBeenCalledTimes(1);
    await expect(cache.get('geo:all')).resolves.toEqual({ total: 1 });
    const publish = redis.eval.mock.calls.find((call) => call[1] === 2)!;
    expect(publish[6]).toBeGreaterThanOrEqual(90);
    expect(publish[6]).toBeLessThanOrEqual(110);
  });

  it('rejects late publication across processes and does not join the old flight', async () => {
    const reader = createCache();
    const writer = createCache();
    const started = deferred<void>();
    const result = deferred<string>();
    const old = reader.wrap('geo:all', async () => {
      started.resolve();
      return result.promise;
    });
    await started.promise;
    await writer.delByPattern('geo:*');
    await expect(reader.wrap('geo:all', async () => 'fresh')).resolves.toBe('fresh');
    result.resolve('old');
    await expect(old).resolves.toBe('old');
    expect(store.has('nexogc:prod:geo:all:g:0')).toBe(false);
    await expect(reader.get('geo:all')).resolves.toBe('fresh');
  });

  it('does not remove a lock acquired by a new owner after lease expiration', async () => {
    const cache = createCache();
    await cache.wrap('geo:all', async () => {
      store.set('nexogc:prod:lock:geo:all:g:0', 'other-owner');
      return 'value';
    });
    expect(store.get('nexogc:prod:lock:geo:all:g:0')).toBe('other-owner');
  });

  it('retries failed family invalidation before reading a recovered cache', async () => {
    const cache = createCache();
    await cache.set('reports:a', 'old');
    redis.incr.mockRejectedValueOnce(new Error('disconnected'));
    await cache.delByPattern('reports:*');
    // A failed SCAN may leave an old snapshot physically present.
    store.set('nexogc:prod:reports:a:g:0', '"old"');
    await expect(cache.get('reports:a')).resolves.toBeUndefined();
    expect(store.get('nexogc:prod:_generation:reports')).toBe('1');
    await expect(cache.wrap('reports:a', async () => 'new')).resolves.toBe('new');
  });

  it('checks generation atomically even if invalidation races with publication', async () => {
    const cache = createCache();
    const evalNormally = redis.eval.getMockImplementation()!;
    redis.eval.mockImplementation(async (script: string, count: number, ...args: (string | number)[]) => {
      if (count === 2) store.set(String(args[0]), '1');
      return evalNormally(script, count, ...args);
    });
    await expect(cache.wrap('geo:all', async () => 'old')).resolves.toBe('old');
    expect(store.has('nexogc:prod:geo:all:g:0')).toBe(false);
  });
});
