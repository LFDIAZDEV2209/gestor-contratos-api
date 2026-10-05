import { DataSource, Logger } from 'typeorm';
import { logStructured } from './logger';

/** TypeORM logger that does not emit query parameters. */
class StructuredTypeOrmLogger implements Logger {
  logQuery(): void {}
  logQueryError(error: string | Error): void { logStructured('error', 'database.query.error', { error: error instanceof Error ? error.name : 'QueryError' }); }
  logQuerySlow(time: number, query: string): void { logStructured('warn', 'database.query.slow', { duracionMs: time, query: query.replace(/'(?:''|[^'])*'/g, "'[REDACTED]'") }); }
  logSchemaBuild(message: string): void { logStructured('info', 'database.schema', { message }); }
  logMigration(message: string): void { logStructured('info', 'database.migration', { message }); }
  log(level: 'log' | 'info' | 'warn', message: unknown): void { logStructured(level === 'log' ? 'info' : level, 'database.typeorm', { message }); }
}

/** Enables TypeORM's native slow-query threshold on the injected DataSource. */
export function configureTypeOrmObservability(dataSource: DataSource): void {
  const options = dataSource.options as typeof dataSource.options & { maxQueryExecutionTime?: number };
  options.maxQueryExecutionTime = 500;
  dataSource.logger = new StructuredTypeOrmLogger();
}
