import { Controller, Get } from '@nestjs/common';
import { Public } from './common/decorators';

@Controller()
export class HealthController {
  @Get('health')
  @Public()
  health(): { ok: boolean; servicio: string } {
    return { ok: true, servicio: 'gestor-contratos-api' };
  }
}
