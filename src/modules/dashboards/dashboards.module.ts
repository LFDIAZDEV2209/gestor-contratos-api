import { Module } from '@nestjs/common';
import { DashboardRefreshService } from './dashboard-refresh.service';

/**
 * Módulo de dashboards: refresco programado de vistas materializadas.
 * DataSource viene del TypeOrmModule.forRootAsync global (no requiere forFeature).
 */
@Module({
  providers: [DashboardRefreshService],
  exports: [DashboardRefreshService],
})
export class DashboardsModule {}
