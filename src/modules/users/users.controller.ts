import { Body, Controller, Get, Param, Put, Post, Req } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CrearUsuarioDto, ActualizarUsuarioDto, AnularDto } from './users.dto';
import { CurrentUser, Perm, Admin, UsuarioInfo } from '../../common/decorators';
import { contextoDe, ReqContext } from '../../common/req-context';
import { Request } from 'express';
import { UserEntity } from './users.entity';

/** Gestión de usuarios (solo ADMINISTRADOR). */
@ApiTags('users')
@Admin()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @Perm('VER')
  listar(): Promise<UserEntity[]> {
    return this.users.listar();
  }

  @Get(':id')
  @Perm('VER')
  obtener(@Param('id') id: string): Promise<UserEntity> {
    return this.users.obtener(id);
  }

  @Post()
  @Perm('CREAR')
  crear(@Body() dto: CrearUsuarioDto, @CurrentUser() user: UsuarioInfo, @Req() req: Request): Promise<UserEntity> {
    const ctx: ReqContext = contextoDe(req, user);
    return this.users.crear(dto, ctx);
  }

  @Put(':id')
  @Perm('EDITAR')
  actualizar(
    @Param('id') id: string,
    @Body() dto: ActualizarUsuarioDto,
    @CurrentUser() user: UsuarioInfo,
    @Req() req: Request,
  ): Promise<UserEntity> {
    const ctx = contextoDe(req, user);
    return this.users.actualizar(id, dto, dto.version, ctx);
  }

  @Post(':id/void')
  @Perm('ANULAR')
  anular(
    @Param('id') id: string,
    @Body() dto: AnularDto,
    @CurrentUser() user: UsuarioInfo,
    @Req() req: Request,
  ): Promise<UserEntity> {
    const ctx = contextoDe(req, user);
    return this.users.anular(id, dto.motivo, ctx);
  }
}
