import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { CacheService } from './cache.service';

export interface ValkeyCacheOptions {
  host: string;
  port: number;
  password?: string;
  tls: boolean;
  defaultTtl: number;
  nodeEnv: string;
}

/** Cliente Valkey tolerante a fallas: un error de caché nunca tumba la petición. */
@Injectable()
export class ValkeyCacheService implements CacheService, OnModuleDestroy {
  private readonly client: Redis;
  private readonly prefix: string;
  private readonly flights = new Map<string, Promise<unknown>>();
  private connecting?: Promise<void>;

  constructor(private readonly options: ValkeyCacheOptions) {
    this.prefix = `nexogc:${options.nodeEnv === 'production' ? 'prod' : 'dev'}:`;
    this.client = new Redis(options.port, options.host, {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 0,
      password: options.password,
      tls: options.tls ? {} : undefined,
      retryStrategy: (times) => Math.min(times * 200, 2_000),
    });
    this.client.on('error', () => undefined);
  }

  async get<T>(key: string): Promise<T | undefined> {
    try {
      if (!(await this.ready())) return undefined;
      const value = await this.client.get(this.key(key));
      return value == null ? undefined : JSON.parse(value) as T;
    } catch { return undefined; }
  }

  async set<T>(key: string, value: T, ttlSeconds = this.options.defaultTtl): Promise<void> {
    try {
      if (await this.ready()) await this.client.set(this.key(key), JSON.stringify(value), 'EX', this.jitter(ttlSeconds));
    } catch { /* cache is best effort */ }
  }

  async del(key: string): Promise<void> {
    try { if (await this.ready()) await this.client.del(this.key(key)); } catch { /* best effort */ }
  }

  async delByPattern(pattern: string): Promise<number> {
    try {
      if (!(await this.ready())) return 0;
      let cursor = '0'; let deleted = 0;
      const match = this.key(pattern);
      do {
        const [next, keys] = await this.client.scan(cursor, 'MATCH', match, 'COUNT', '100');
        cursor = next;
        if (keys.length) deleted += await this.client.del(...keys);
      } while (cursor !== '0');
      return deleted;
    } catch { return 0; }
  }

  async wrap<T>(key: string, factory: () => Promise<T>, ttlSeconds = this.options.defaultTtl): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== undefined) return cached;
    const active = this.flights.get(key) as Promise<T> | undefined;
    if (active) return active;
    const flight = this.populate(key, factory, ttlSeconds).finally(() => this.flights.delete(key));
    this.flights.set(key, flight);
    return flight;
  }

  async ping(): Promise<boolean> {
    try { return (await this.ready()) && (await this.client.ping()) === 'PONG'; } catch { return false; }
  }

  async onModuleDestroy(): Promise<void> {
    try { await this.client.quit(); } catch { /* client may never have connected */ }
  }

  private async populate<T>(key: string, factory: () => Promise<T>, ttlSeconds: number): Promise<T> {
    const lockKey = `lock:${key}`;
    let lock = false;
    try {
      lock = (await this.ready()) && (await this.client.set(this.key(lockKey), '1', 'NX', 'PX', '10000')) === 'OK';
      if (!lock) {
        for (let i = 0; i < 5; i += 1) {
          await new Promise<void>((resolve) => setTimeout(resolve, 100));
          const cached = await this.get<T>(key);
          if (cached !== undefined) return cached;
        }
      }
      const value = await factory();
      await this.set(key, value, ttlSeconds);
      return value;
    } finally {
      if (lock) await this.del(lockKey);
    }
  }

  private async ready(): Promise<boolean> {
    if (!this.connecting) this.connecting = this.client.connect().catch(() => undefined);
    await this.connecting;
    return true;
  }

  private key(key: string): string { return `${this.prefix}${key}`; }
  private jitter(ttlSeconds: number): number { return Math.max(1, Math.floor(ttlSeconds * (0.9 + Math.random() * 0.2))); }
}
