import { Injectable } from '@nestjs/common';
import { CacheService } from './cache.service';

interface Entry { value: string; expiresAt: number }

/** Fallback local para desarrollo y cuando Valkey no está configurado. */
@Injectable()
export class MemoryCacheService implements CacheService {
  private readonly entries = new Map<string, Entry>();
  private readonly flights = new Map<string, Promise<unknown>>();
  private readonly generations = new Map<string, number>();
  private readonly maxEntries = 500;

  async get<T>(key: string): Promise<T | undefined> {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return undefined;
    }
    this.entries.delete(key);
    this.entries.set(key, entry);
    return JSON.parse(entry.value) as T;
  }

  async set<T>(key: string, value: T, ttlSeconds = 300): Promise<void> {
    for (const [entryKey, entry] of this.entries) {
      if (entry.expiresAt <= Date.now()) this.entries.delete(entryKey);
    }
    this.entries.delete(key);
    this.entries.set(key, { value: JSON.stringify(value), expiresAt: Date.now() + this.jitter(ttlSeconds) * 1000 });
    while (this.entries.size > this.maxEntries) {
      this.entries.delete(this.entries.keys().next().value!);
    }
  }

  async del(key: string): Promise<void> {
    this.bump(key);
    this.entries.delete(key);
  }

  async delByPattern(pattern: string): Promise<number> {
    this.bump(pattern);
    const matcher = new RegExp(`^${pattern.replace(/[.+^${}()|[\\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`);
    const keys = [...this.entries.keys()].filter((key) => matcher.test(key));
    keys.forEach((key) => this.entries.delete(key));
    return keys.length;
  }

  async wrap<T>(key: string, factory: () => Promise<T>, ttlSeconds = 300): Promise<T> {
    const family = key.split(':')[0];
    const generation = this.generations.get(family) ?? 0;
    const flightKey = `${generation}:${key}`;
    const cached = await this.get<T>(key);
    if (generation !== (this.generations.get(family) ?? 0)) return this.wrap(key, factory, ttlSeconds);
    if (cached !== undefined) return cached;
    const active = this.flights.get(flightKey) as Promise<T> | undefined;
    if (active) return active;
    const flight = Promise.resolve().then(factory).then(async (value) => {
      if (generation === (this.generations.get(family) ?? 0)) await this.set(key, value, ttlSeconds);
      return value;
    }).finally(() => this.flights.delete(flightKey));
    this.flights.set(flightKey, flight);
    return flight;
  }

  async ping(): Promise<boolean> { return true; }

  private bump(key: string): void {
    const family = key.split(':')[0];
    this.generations.set(family, (this.generations.get(family) ?? 0) + 1);
  }

  private jitter(ttlSeconds: number): number {
    return Math.max(1, Math.floor(ttlSeconds * (0.9 + Math.random() * 0.2)));
  }
}
