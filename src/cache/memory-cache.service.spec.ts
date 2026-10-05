import { MemoryCacheService } from './memory-cache.service';

describe('MemoryCacheService', () => {
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
