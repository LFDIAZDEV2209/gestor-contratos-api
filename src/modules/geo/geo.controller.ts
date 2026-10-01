import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { GeoService } from './geo.service';
import { Perm } from '../../common/decorators';

@ApiTags('geo')
@Controller('geo')
export class GeoController {
  constructor(private readonly geo: GeoService) {}

  @Get('departments')
  @Perm('VER')
  @ApiQuery({ name: 'metric', required: false, description: 'contratos|polizas|clientes' })
  @ApiQuery({ name: 'measure', required: false, description: 'n|v' })
  @ApiQuery({ name: 'aseguradora', required: false })
  @ApiQuery({ name: 'estado', required: false, description: 'ejecucion|suspendido|liquidacion|liquidado|terminado' })
  @ApiQuery({ name: 'companyId', required: false })
  @ApiOperation({ summary: 'Agregado por departamento (código DANE, región, contratos, pólizas, clientes)' })
  departamentos(@Query() q: Record<string, unknown>) {
    return this.geo.departamentos(q as never);
  }

  @Get('regions')
  @Perm('VER')
  @ApiOperation({ summary: 'Mismo agregado por región, sin duplicar contratos multicobertura' })
  regiones(@Query() q: Record<string, unknown>) {
    return this.geo.regiones(q as never);
  }
}
