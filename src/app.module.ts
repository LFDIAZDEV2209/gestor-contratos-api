import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import configuration from './config/configuration';
import { ENTIDADES } from './database/entities';
import { SnakeNamingStrategy } from './database/snake-naming.strategy';
import './database/pg-types';
import { AuditModule } from './modules/audit/audit.module';
import { AuditReadOnlyModule } from './modules/audit/audit-read-only.module';
import { RolesModule } from './modules/roles/roles.module';
import { SettingsModule } from './modules/settings/settings.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CompaniesModule } from './modules/companies/companies.module';
import { InsuranceModule } from './modules/insurance/insurance.module';
import { AlertsModule } from './modules/alerts/alerts.module';
import { ReportsModule } from './modules/reports/reports.module';
import { GeoModule } from './modules/geo/geo.module';
import { ContractsCoreModule } from './modules/contracts/contracts.module';
import { ChildCollectionsModule } from './modules/contracts/child-collections.module';
import { DashboardsModule } from './modules/dashboards/dashboards.module';
import { HealthController } from './health.controller';
import { CacheModule } from './cache/cache.module';

/**
 * Composición de la aplicación. El orden importa para el enrutador de Express:
 * los controladores específicos (alerts, insurers, quotas, guarantees…)
 * se registran antes del controlador genérico de colecciones hijas,
 * que va dentro de ContractsModule (último).
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration], envFilePath: ['.env'] }),
    TypeOrmModule.forRootAsync({      inject: [ConfigService],
      useFactory: (cs: ConfigService) => ({
        type: 'postgres' as const,
        host: cs.get<string>('db.host'),
        port: cs.get<number>('db.port'),
        username: cs.get<string>('db.user'),
        password: cs.get<string>('db.password'),
        database: cs.get<string>('db.name'),
        entities: ENTIDADES,
        // NUNCA synchronize en producción: solo migraciones.
        synchronize: false,
        namingStrategy: new SnakeNamingStrategy(),
        logging: ['error'],
      }),
    }),
    AuditModule,
    SettingsModule,
    AuthModule,
    RolesModule,
    UsersModule,
    GeoModule,
    ReportsModule,
    AlertsModule,
    InsuranceModule,
    CompaniesModule,
    AuditReadOnlyModule,
    ContractsCoreModule,
    ChildCollectionsModule,
    DashboardsModule,
    CacheModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
