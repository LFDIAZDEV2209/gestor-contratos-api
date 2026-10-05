export interface CacheService {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
  delByPattern(pattern: string): Promise<number>;
  wrap<T>(key: string, factory: () => Promise<T>, ttlSeconds?: number): Promise<T>;
  ping(): Promise<boolean>;
}

export const CACHE_SERVICE = Symbol('CACHE_SERVICE');

export const CACHE_TTLS = {
  settings: 10 * 60,
  geo: 15 * 60,
  reports: 2 * 60,
} as const;
