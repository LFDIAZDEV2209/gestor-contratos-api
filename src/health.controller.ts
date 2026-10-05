import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CACHE_SERVICE, CacheService } from './cache/cache.service';
import { Public } from './common/decorators';

@Controller()
export class HealthController {
  constructor(
    private readonly dataSource: DataSource,
    @Inject(CACHE_SERVICE) private readonly cache: CacheService,
  ) {}

  @Get('health')
  @Public()
  health(): { ok: boolean; servicio: string } {
    return { ok: true, servicio: 'gestor-contratos-api' };
  }

  @Get('health/live')
  @Public()
  live(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @Get('health/ready')
  @Public()
  async ready(): Promise<{ status: 'ok' }> {
    try {
      await this.dataSource.query('SELECT 1');
      if (!(await this.cache.ping())) throw new Error('Cache unavailable');
      return { status: 'ok' };
    } catch {
      throw new ServiceUnavailableException({ status: 'unavailable' });
    }
  }
}
