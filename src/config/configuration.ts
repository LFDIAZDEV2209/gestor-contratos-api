/** Configuración de la aplicación leída de variables de entorno (ver .env.example). */
export interface Configuracion {
  port: number;
  pageSize: number;
  nodeEnv: string;
  cors: string[];
  alertCron: string;
  uploadDir: string;
  db: { host: string; port: number; user: string; password: string; name: string };
  cache: {
    host?: string;
    port: number;
    password?: string;
    tls: boolean;
    driver: 'valkey' | 'memory';
    defaultTtl: number;
  };
}

export default (): Configuracion => ({
  port: Number(process.env.PORT ?? 4000),
  pageSize: Number(process.env.DEFAULT_PAGE_SIZE ?? 25),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  cors: (process.env.CORS_ORIGIN ?? 'http://localhost:3000,http://localhost:3001')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  alertCron: process.env.ALERT_CRON ?? '0 6 * * *',
  uploadDir: process.env.UPLOAD_DIR ?? './data/uploads',
  cache: {
    host: process.env.VALKEY_HOST || undefined,
    port: Number(process.env.VALKEY_PORT ?? 6379),
    password: process.env.VALKEY_PASSWORD || undefined,
    tls: process.env.VALKEY_TLS === 'true' || process.env.VALKEY_TLS === '1',
    driver: process.env.CACHE_DRIVER === 'memory' ? 'memory' : 'valkey',
    defaultTtl: Number(process.env.CACHE_DEFAULT_TTL ?? 300),
  },
  db: {
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5433),
    user: process.env.DB_USER ?? 'gestor',
    password: process.env.DB_PASSWORD ?? 'gestor_demo_2026',
    name: process.env.DB_NAME ?? 'gestor_contratos',
  },
});
