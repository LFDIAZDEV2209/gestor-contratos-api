import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AlertsService } from './alerts.service';

/**
 * Worker diario (files/03): recalcula las alertas a las 6:00 a. m.
 * (configurable con ALERT_CRON). La notificación por correo/WhatsApp al
 * cruzar umbral se activa en la fase 3.
 */
@Injectable()
export class AlertsWorker {
  private readonly logger = new Logger(AlertsWorker.name);

  constructor(private readonly alerts: AlertsService) {}

  @Cron(process.env.ALERT_CRON ?? '0 6 * * *', { name: 'recalcular-alertas', timeZone: 'America/Bogota' })
  async recalcular(): Promise<void> {
    try {
      const r = await this.alerts.recalcular();
      this.logger.log(`Alertas recalculadas: ${r.total} vivas, ${r.nuevas} nuevas.`);
    } catch (e) {
      this.logger.error(`Fallo al recalcular alertas: ${e instanceof Error ? e.message : e}`);
    }
  }
}
