import 'dotenv/config';
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from './snake-naming.strategy';
import { ENTIDADES } from './entities';
import './pg-types';

/**
 * DataSource para la CLI de migraciones de TypeORM (y el seed).
 * synchronize SIEMPRE en false: el esquema vive solo en las migraciones.
 */
export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5433),
  username: process.env.DB_USER ?? 'gestor',
  password: process.env.DB_PASSWORD ?? 'gestor_demo_2026',
  database: process.env.DB_NAME ?? 'gestor_contratos',
  entities: ENTIDADES,
  synchronize: false,
  namingStrategy: new SnakeNamingStrategy(),
  migrations: [`${__dirname}/migrations/*{.ts,.js}`],
  logging: ['error'],
  // TLS contra RDS en producción (rds.force_ssl=1 en PG16 de RDS). TODO(AWS): CA bundle.
  ssl:
    (process.env.NODE_ENV ?? 'development') === 'production'
      ? { rejectUnauthorized: false }
      : undefined,
});
