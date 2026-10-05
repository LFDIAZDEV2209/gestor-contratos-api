import { MemoryCacheService } from './memory-cache.service';

describe('MemoryCacheService', () => {
  afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

  it('evicts the least recently used entry at the 500 entry limit', async () => {
    const cache = new MemoryCacheService();
    for (let i = 0; i < 500; i += 1) await cache.set(`geo:${i}`, i);
    await cache.get('geo:0');
    await cache.set('geo:500', 500);
    await expect(cache.get('geo:1')).resolves.toBeUndefined();
    await expect(cache.get('geo:0')).resolves.toBe(0);
    await expect(cache.delByPattern('geo:*')).resolves.toBe(500);
  });

  it('sweeps expired entries before evicting a live LRU entry', async () => {
    jest.useFakeTimers();
    const cache = new MemoryCacheService();
    for (let i = 0; i < 499; i += 1) await cache.set(`geo:${i}`, i, 60);
    await cache.set('geo:expired', true, 1);
    await jest.advanceTimersByTimeAsync(2_000);
    await cache.set('geo:new', true, 60);
    await expect(cache.get('geo:0')).resolves.toBe(0);
    await expect(cache.get('geo:expired')).resolves.toBeUndefined();
    await expect(cache.delByPattern('geo:*')).resolves.toBe(500);
  });

  it('does not publish or join a stale factory after invalidation', async () => {
    const cache = new MemoryCacheService();
    let finish!: (value: string) => void;
    let started!: () => void;
    const signal = new Promise<void>((resolve) => { started = resolve; });
    const old = cache.wrap('reports:a', () => {
      started();
      return new Promise<string>((resolve) => { finish = resolve; });
    });
    await signal;
    await cache.delByPattern('reports:*');
    await expect(cache.wrap('reports:a', async () => 'new')).resolves.toBe('new');
    finish('old');
    await expect(old).resolves.toBe('old');
    await expect(cache.get('reports:a')).resolves.toBe('new');
  });

  it('cleans a flight after synchronous factory failure', async () => {
    const cache = new MemoryCacheService();
    const error = new Error('factory');
    await expect(cache.wrap('geo:a', () => { throw error; })).rejects.toBe(error);
    await expect(cache.wrap('geo:a', async () => 'retry')).resolves.toBe('retry');
  });
  it('reuses an in-flight factory and caches its result', async () => {
    const cache = new MemoryCacheService();
    const factory = jest.fn(async () => ({ ok: true }));
    const [first, second] = await Promise.all([
      cache.wrap('settings:parametros', factory, 60),
      cache.wrap('settings:parametros', factory, 60),
    ]);

    expect(first).toEqual({ ok: true });
    expect(second).toEqual({ ok: true });
    expect(factory).toHaveBeenCalledTimes(1);
    await expect(cache.get('settings:parametros')).resolves.toEqual({ ok: true });
  });

  it('deletes matching keys only', async () => {
    const cache = new MemoryCacheService();
    await cache.set('settings:a', 1, 60);
    await cache.set('settings:b', 2, 60);
    await cache.set('geo:a', 3, 60);

    await expect(cache.delByPattern('settings:*')).resolves.toBe(2);
    await expect(cache.get('geo:a')).resolves.toBe(3);
  });
});
