import { DefaultNamingStrategy } from 'typeorm';
import { SnakeCaseNamingStrategy } from './snake-case.util';

/**
 * Estrategia snake_case para PostgreSQL: camelCase del código → snake_case en BD
 * (created_at, nit_contratista…). Convención de postgresql-table-design.
 */
export class SnakeNamingStrategy extends DefaultNamingStrategy {
  override tableName(className: string, customName?: string): string {
    return customName ?? SnakeCaseNamingStrategy.camelToSnake(className);
  }

  override columnName(propertyName: string, customName?: string, embeddedPrefixes: string[] = []): string {
    const prefijo = embeddedPrefixes.map((p) => SnakeCaseNamingStrategy.camelToSnake(p)).join('_');
    const nombre = customName ?? SnakeCaseNamingStrategy.camelToSnake(propertyName);
    return prefijo ? `${prefijo}_${nombre}` : nombre;
  }

  override relationName(propertyName: string): string {
    return SnakeCaseNamingStrategy.camelToSnake(propertyName);
  }

  override joinColumnName(relationName: string, referencedColumnName: string): string {
    return `${SnakeCaseNamingStrategy.camelToSnake(relationName)}_${referencedColumnName}`;
  }

  override joinTableName(
    firstTableName: string,
    secondTableName: string,
    firstPropertyName: string,
    _secondPropertyName: string,
  ): string {
    return `${SnakeCaseNamingStrategy.camelToSnake(firstTableName)}_${SnakeCaseNamingStrategy.camelToSnake(firstPropertyName)}_${SnakeCaseNamingStrategy.camelToSnake(secondTableName)}`;
  }

  override joinTableColumnName(tableName: string, propertyName: string, columnName?: string): string {
    return `${SnakeCaseNamingStrategy.camelToSnake(tableName)}_${columnName ?? SnakeCaseNamingStrategy.camelToSnake(propertyName)}`;
  }
}
