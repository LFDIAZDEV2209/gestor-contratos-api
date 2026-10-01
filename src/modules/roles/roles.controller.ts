import { Body, Controller, Get, Param, Put, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolesService } from './roles.service';
import { Admin, CurrentUser, Perm, UsuarioInfo, ROLES } from '../../common/decorators';
import { contextoDe, ReqContext } from '../../common/req-context';
import { Request } from 'express';
import { CambioPermiso } from './roles.service';

/** Matriz rol × permiso (solo ADMINISTRADOR). */
@ApiTags('roles')
@Admin()
@Controller('roles')
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  @Get('permissions')
  @Perm('VER')
  @ApiOperation({ summary: 'Matriz rol × permiso vigente' })
  matriz() {
    return this.roles.consultarMatriz([...ROLES]);
  }

  @Put('permissions')
  @Perm('EDITAR')
  @ApiOperation({ summary: 'Actualiza casillas de la matriz; ADMINISTRADOR siempre queda con todo' })
  actualizar(@Body() dto: { cambios: CambioPermiso[] }, @CurrentUser() user: UsuarioInfo, @Req() req: Request) {
    const ctx: ReqContext = contextoDe(req, user);
    return this.roles.actualizarMatriz(dto.cambios ?? [], ctx, [...ROLES]);
  }
}
