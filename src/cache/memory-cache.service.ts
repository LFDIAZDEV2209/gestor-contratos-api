import { Injectable } from '@nestjs/common';
import { CacheService } from './cache.service';

interface Entry { value: string; expiresAt: number }

/** Fallback local para desarrollo y cuando Valkey no está configurado. */
@Injectable()
export class MemoryCacheService implements CacheService {
  private readonly entries = new Map<string, Entry>();
  private readonly flights = new Map<string, Promise<unknown>>();

  async get<T>(key: string): Promise<T | undefined> {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return JSON.parse(entry.value) as T;
  }

  async set<T>(key: string, value: T, ttlSeconds = 300): Promise<void> {
    this.entries.set(key, { value: JSON.stringify(value), expiresAt: Date.now() + this.jitter(ttlSeconds) * 1000 });
  }

  async del(key: string): Promise<void> { this.entries.delete(key); }

  async delByPattern(pattern: string): Promise<number> {
    const matcher = new RegExp(`^${pattern.replace(/[.+^${}()|[\\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`);
    const keys = [...this.entries.keys()].filter((key) => matcher.test(key));
    keys.forEach((key) => this.entries.delete(key));
    return keys.length;
  }

  async wrap<T>(key: string, factory: () => Promise<T>, ttlSeconds = 300): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== undefined) return cached;
    const active = this.flights.get(key) as Promise<T> | undefined;
    if (active) return active;
    const flight = factory().then(async (value) => {
      await this.set(key, value, ttlSeconds);
      return value;
    }).finally(() => this.flights.delete(key));
    this.flights.set(key, flight);
    return flight;
  }

  async ping(): Promise<boolean> { return true; }

  private jitter(ttlSeconds: number): number {
    return Math.max(1, Math.floor(ttlSeconds * (0.9 + Math.random() * 0.2)));
  }
}
