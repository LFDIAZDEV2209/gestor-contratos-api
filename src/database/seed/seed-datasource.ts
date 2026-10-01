import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from '../snake-naming.strategy';
import { ENTIDADES } from '../entities';
import '../pg-types';

/** DataSource reutilizable para scripts (seed). */
export function dsSeed(): DataSource {
  return new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5433),
    username: process.env.DB_USER ?? 'gestor',
    password: process.env.DB_PASSWORD ?? 'gestor_demo_2026',
    database: process.env.DB_NAME ?? 'gestor_contratos',
    entities: ENTIDADES,
    synchronize: false,
    namingStrategy: new SnakeNamingStrategy(),
    logging: ['error'],
  });
}
