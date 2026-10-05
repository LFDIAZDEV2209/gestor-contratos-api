declare module 'ioredis' {
  interface RedisOptions {
    lazyConnect?: boolean;
    enableOfflineQueue?: boolean;
    maxRetriesPerRequest?: number | null;
    connectTimeout?: number;
    commandTimeout?: number;
    password?: string;
    tls?: Record<string, never>;
    retryStrategy?: (times: number) => number | null;
  }
  export default class Redis {
    readonly status: string;
    constructor(port: number, host: string, options?: RedisOptions);
    on(event: string, listener: (...args: unknown[]) => void): this;
    connect(): Promise<void>;
    get(key: string): Promise<string | null>;
    set(key: string, value: string, ...args: (string | number)[]): Promise<string | null>;
    del(...keys: string[]): Promise<number>;
    scan(cursor: string, ...args: string[]): Promise<[string, string[]]>;
    ping(): Promise<string>;
    quit(): Promise<void>;
    disconnect(): void;
    incr(key: string): Promise<number>;
    eval(script: string, numberOfKeys: number, ...args: (string | number)[]): Promise<unknown>;
  }
}
