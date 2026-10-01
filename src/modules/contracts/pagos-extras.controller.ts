import { BadRequestException, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PagosService } from './pagos.service';
import { CurrentUser, Perm, UsuarioInfo } from '../../common/decorators';
import { contextoDe } from '../../common/req-context';
import { Request } from 'express';

@ApiTags('payments')
@Controller('payments')
export class PagosExtrasController {
  constructor(private readonly pagos: PagosService) {}

  @Post(':id/approve')
  @Perm('APROBAR')
  @ApiOperation({ summary: 'Aprobar el pago (permiso APROBAR)' })
  aprobar(@Param('id') id: string, @CurrentUser() u: UsuarioInfo, @Req() req: Request) {
    return this.pagos.aprobar(id, contextoDe(req, u));
  }

  @Post(':id/pay')
  @Perm('APROBAR')
  @ApiOperation({ summary: 'Marcar el pago como pagado (permiso APROBAR)' })
  pagar(@Param('id') id: string, @CurrentUser() u: UsuarioInfo, @Req() req: Request) {
    return this.pagos.pagar(id, contextoDe(req, u));
  }
}
