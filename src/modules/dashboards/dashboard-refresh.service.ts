import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Cron } from '@nestjs/schedule';

/**
 * Servicio autónomo de refresco concurrente para Vistas Materializadas:
 * - mv_geo_aggregates: agregados geográficos del mapa de Colombia
 * - mv_reports_summary: resumen analítico para reportes de contratos
 * - mv_dashboard_kpis: métricas ejecutivas y KPIs para el dashboard principal
 *
 * Programado para correr en zona horaria America/Bogota coordinado con alerts.worker.ts (06:05 a. m.).
 */
@Injectable()
export class DashboardRefreshService {
  private readonly logger = new Logger(DashboardRefreshService.name);

  constructor(private readonly dataSource: DataSource) {}

  /**
   * Refresco automático diario programado a las 6:05 a. m. (America/Bogota),
   * 5 minutos después del recálculo de alertas (06:00 a. m. en alerts.worker.ts).
   */
  @Cron(process.env.DASHBOARD_REFRESH_CRON ?? '5 6 * * *', {
    name: 'refresh-materialized-views',
    timeZone: 'America/Bogota',
  })
  async scheduledRefresh(): Promise<void> {
    this.logger.log('Iniciando refresco programado de Vistas Materializadas...');
    await this.refreshAll();
  }

  /** Refresco concurrente de todas las vistas materializadas analíticas. */
  async refreshAll(): Promise<{
    geo: boolean;
    reports: boolean;
    dashboard: boolean;
    durationMs: number;
  }> {
    const start = Date.now();
    let geo = false;
    let reports = false;
    let dashboard = false;

    try {
      await this.refreshGeoAggregates();
      geo = true;
    } catch (e) {
      this.logger.error(`Error refrescando mv_geo_aggregates: ${e instanceof Error ? e.message : e}`);
    }

    try {
      await this.refreshReportsSummary();
      reports = true;
    } catch (e) {
      this.logger.error(`Error refrescando mv_reports_summary: ${e instanceof Error ? e.message : e}`);
    }

    try {
      await this.refreshDashboardKpis();
      dashboard = true;
    } catch (e) {
      this.logger.error(`Error refrescando mv_dashboard_kpis: ${e instanceof Error ? e.message : e}`);
    }

    const durationMs = Date.now() - start;
    this.logger.log(`Refresco de Vistas Materializadas finalizado en ${durationMs} ms (geo: ${geo}, reports: ${reports}, dashboard: ${dashboard}).`);
    return { geo, reports, dashboard, durationMs };
  }

  async refreshGeoAggregates(): Promise<void> {
    await this.dataSource.query('REFRESH MATERIALIZED VIEW CONCURRENTLY mv_geo_aggregates;');
  }

  async refreshReportsSummary(): Promise<void> {
    await this.dataSource.query('REFRESH MATERIALIZED VIEW CONCURRENTLY mv_reports_summary;');
  }

  async refreshDashboardKpis(): Promise<void> {
    await this.dataSource.query('REFRESH MATERIALIZED VIEW CONCURRENTLY mv_dashboard_kpis;');
  }
}
