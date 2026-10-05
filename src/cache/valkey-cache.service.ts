import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
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

// Atomic generation check prevents late factories from republishing old snapshots.
const PUBLISH = [
  "if (redis.call('GET', KEYS[1]) or '0') ~= ARGV[1] then return 0 end",
  "redis.call('SET', KEYS[2], ARGV[2], 'EX', ARGV[3])",
  'return 1',
].join('\n');
const RELEASE = [
  "if redis.call('GET', KEYS[1]) == ARGV[1] then",
  "return redis.call('DEL', KEYS[1]) end",
  'return 0',
].join('\n');

interface Generation { family: string; local: number; remote?: string }

@Injectable()
export class ValkeyCacheService implements CacheService, OnModuleDestroy {
  private readonly client: Redis;
  private readonly prefix: string;
  private readonly logger = new Logger(ValkeyCacheService.name);
  private readonly flights = new Map<string, Promise<unknown>>();
  private readonly generations = new Map<string, number>();
  private readonly pendingInvalidations = new Map<string, number>();
  private connecting?: Promise<void>;

  constructor(private readonly options: ValkeyCacheOptions) {
    this.prefix = 'nexogc:' + (options.nodeEnv === 'production' ? 'prod' : 'dev') + ':';
    this.client = new Redis(options.port, options.host, {
      lazyConnect: true, enableOfflineQueue: false, maxRetriesPerRequest: 0,
      connectTimeout: 1_000, commandTimeout: 1_000,
      password: options.password, tls: options.tls ? {} : undefined,
      retryStrategy: (times) => Math.min(times * 200, 2_000),
    });
    this.client.on('error', () => undefined);
  }

  async get<T>(key: string): Promise<T | undefined> {
    return this.read<T>(key, await this.generation(key));
  }

  async set<T>(key: string, value: T, ttlSeconds = this.options.defaultTtl): Promise<void> {
    await this.publish(key, value, ttlSeconds, await this.generation(key));
  }

  async del(key: string): Promise<void> {
    await this.invalidate(key.split(':')[0]);
    await this.remove(key + ':g:*');
  }

  async delByPattern(pattern: string): Promise<number> {
    await this.invalidate(pattern.split(':')[0]);
    return this.remove(pattern);
  }

  async wrap<T>(key: string, factory: () => Promise<T>, ttlSeconds = this.options.defaultTtl): Promise<T> {
    const generation = await this.generation(key);
    const cached = await this.read<T>(key, generation);
    if (generation.local !== this.localGeneration(generation.family)) return this.wrap(key, factory, ttlSeconds);
    if (cached !== undefined) return cached;
    const flightKey = generation.local + ':' + (generation.remote ?? 'offline') + ':' + key;
    const active = this.flights.get(flightKey) as Promise<T> | undefined;
    if (active) return active;
    const flight = this.populate(key, factory, ttlSeconds, generation).finally(() => this.flights.delete(flightKey));
    this.flights.set(flightKey, flight);
    return flight;
  }

  async ping(): Promise<boolean> {
    try { await this.ready(); return (await this.client.ping()) === 'PONG'; } catch { return false; }
  }

  async onModuleDestroy(): Promise<void> {
    try { await this.client.quit(); } catch { this.client.disconnect(); }
  }

  private async populate<T>(key: string, factory: () => Promise<T>, ttlSeconds: number, generation: Generation): Promise<T> {
    const lockKey = this.key('lock:' + key + ':g:' + generation.remote);
    const token = randomUUID();
    let locked = false;
    let infrastructureAvailable = generation.remote !== undefined;
    const deadline = Date.now() + 5_000;
    try {
      if (infrastructureAvailable) {
        try {
          locked = await this.bounded(this.client.set(lockKey, token, 'NX', 'PX', 10_000), 5_000) === 'OK';
          while (!locked && Date.now() < deadline) {
            await new Promise<void>((resolve) => setTimeout(resolve, Math.min(100, deadline - Date.now())));
            const raw = await this.bounded(this.client.get(this.dataKey(key, generation)), Math.max(1, deadline - Date.now()));
            if (raw !== null) return JSON.parse(raw) as T;
          }
        } catch {
          infrastructureAvailable = false;
          this.logger.warn('Valkey lock unavailable; using in-process single-flight.');
        }
      }
      // Factory errors propagate, even when infrastructure is unavailable.
      const value = await factory();
      if (infrastructureAvailable) await this.publish(key, value, ttlSeconds, generation);
      return value;
    } finally {
      if (locked) {
        try { await this.client.eval(RELEASE, 1, lockKey, token); }
        catch { this.logger.warn('Valkey lock release failed; lease will expire.'); }
      }
    }
  }

  private async generation(key: string): Promise<Generation> {
    const family = key.split(':')[0];
    const local = this.localGeneration(family);
    try {
      await this.ready();
      await this.flushInvalidation(family);
      return { family, local, remote: (await this.client.get(this.generationKey(family))) ?? '0' };
    } catch {
      this.logger.warn('Valkey unavailable; using in-process single-flight.');
      return { family, local };
    }
  }

  private async read<T>(key: string, generation: Generation): Promise<T | undefined> {
    if (generation.remote === undefined) return undefined;
    try {
      const raw = await this.client.get(this.dataKey(key, generation));
      return raw == null ? undefined : JSON.parse(raw) as T;
    } catch { return undefined; }
  }

  private async publish<T>(key: string, value: T, ttlSeconds: number, generation: Generation): Promise<void> {
    if (generation.remote === undefined || generation.local !== this.localGeneration(generation.family)) return;
    try {
      await this.client.eval(PUBLISH, 2, this.generationKey(generation.family), this.dataKey(key, generation),
        generation.remote, JSON.stringify(value), this.jitter(ttlSeconds));
    } catch { this.logger.warn('Valkey publication failed; continuing without cache.'); }
  }

  private async invalidate(family: string): Promise<void> {
    this.generations.set(family, this.localGeneration(family) + 1);
    this.pendingInvalidations.set(family, this.localGeneration(family));
    try {
      await this.ready();
      await this.flushInvalidation(family);
    } catch { this.logger.warn('Valkey family invalidation failed.'); }
  }

  private async flushInvalidation(family: string): Promise<void> {
    const pending = this.pendingInvalidations.get(family);
    if (pending === undefined) return;
    await this.client.incr(this.generationKey(family));
    if (this.pendingInvalidations.get(family) === pending) this.pendingInvalidations.delete(family);
  }

  private async remove(pattern: string): Promise<number> {
    try {
      await this.ready();
      let cursor = '0'; let deleted = 0;
      do {
        const [next, keys] = await this.client.scan(cursor, 'MATCH', this.key(pattern), 'COUNT', '100');
        cursor = next;
        if (keys.length) deleted += await this.client.del(...keys);
      } while (cursor !== '0');
      return deleted;
    } catch { return 0; }
  }

  private async ready(): Promise<void> {
    if (this.client.status === 'ready') return;
    if (!this.connecting) {
      this.connecting = this.bounded(this.client.connect()).finally(() => { this.connecting = undefined; });
    }
    await this.connecting;
  }

  private async bounded<T>(operation: Promise<T>, timeoutMs = 1_000): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        operation,
        new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Valkey timeout')), timeoutMs); }),
      ]);
    } finally { if (timer) clearTimeout(timer); }
  }

  private localGeneration(family: string): number { return this.generations.get(family) ?? 0; }
  private generationKey(family: string): string { return this.key('_generation:' + family); }
  private dataKey(key: string, generation: Generation): string { return this.key(key + ':g:' + generation.remote); }
  private key(key: string): string { return this.prefix + key; }
  private jitter(ttlSeconds: number): number { return Math.max(1, Math.floor(ttlSeconds * (0.9 + Math.random() * 0.2))); }
}
