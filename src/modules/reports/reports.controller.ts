import { Controller, Get, Param, Query, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { ReportsService } from './reports.service';
import { CurrentUser, Perm, UsuarioInfo } from '../../common/decorators';
import { contextoDe } from '../../common/req-context';
import { Request } from 'express';

@ApiTags('reports')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get(':key')
  @Perm('EXPORTAR')
  @ApiOperation({
    summary: 'Reporte por clave (19) en json, xlsx o pdf',
    description: 'Claves: r_general, r_empresa, r_estado, r_anio, r_proximos, r_fin, r_cont, r_pagos, r_gar, r_inc, r_rg, r_sub, r_aud, r_resp, r_aseg, r_aseg_det, r_cupos, r_region, r_sup',
  })
  async porClave(
    @Param('key') key: string,
    @Query('format') format: string,
    @CurrentUser() u: UsuarioInfo,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.reports.responder(key, format ?? 'json', res, contextoDe(req, u));
  }
}
