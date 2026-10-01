import { Body, Controller, Get, Param, Put, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SettingsService, CATALOGOS_DEFECTO } from './settings.service';
import { Perm, Admin, CurrentUser, UsuarioInfo } from '../../common/decorators';
import { contextoDe, ReqContext } from '../../common/req-context';
import { Request } from 'express';
import { ActualizarParametrosDto, ActualizarCatalogoDto } from './settings.dto';

/** Configuración del sistema: parámetros y catálogos (solo ADMINISTRADOR). */
@ApiTags('settings')
@Admin()
@Controller()
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get('settings')
  @Perm('VER')
  @ApiOperation({ summary: 'Parámetros del sistema (solo ADMINISTRADOR)' })
  async obtener() {
    return (await this.settings.obtener());
  }

  @Put('settings')
  @Perm('EDITAR')
  async actualizar(
    @Body() dto: ActualizarParametrosDto,
    @CurrentUser() user: UsuarioInfo,
    @Req() req: Request,
  ) {
    const ctx: ReqContext = contextoDe(req, user);
    return this.settings.actualizar(dto, ctx);
  }

  @Get('catalogs')
  @Perm('VER')
  @ApiOperation({ summary: 'Catálogos disponibles' })
  async catalogs(): Promise<{ disponibles: string[]; porDefecto: string[] }> {
    return { disponibles: await this.settings.nombresCatalogos(), porDefecto: Object.keys(CATALOGOS_DEFECTO) };
  }

  @Get('catalogs/:nombre')
  @Perm('VER')
  catalogo(@Param('nombre') nombre: string) {
    return this.settings.catalogo(nombre);
  }

  @Put('catalogs/:nombre')
  @Perm('EDITAR')
  @ApiOperation({ summary: 'Reemplaza los valores de un catálogo' })
  actualizarCatalogo(
    @Param('nombre') nombre: string,
    @Body() dto: ActualizarCatalogoDto,
    @CurrentUser() user: UsuarioInfo,
    @Req() req: Request,
  ) {
    const ctx = contextoDe(req, user);
    return this.settings.actualizarCatalogo(nombre, dto.valores, ctx);
  }
}
