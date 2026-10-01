import { BadRequestException, Body, Controller, Get, Param, Post, Put, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AlertsService } from './alerts.service';
import { CrearTareaDto, ActualizarTareaDto, DelegarAlertaDto, ResolverAlertaDto } from '../contracts/children.dto';
import { CurrentUser, Perm, UsuarioInfo } from '../../common/decorators';
import { contextoDe } from '../../common/req-context';
import { Request } from 'express';
import { TaskEntity } from './alerts.entity';

/** Alertas recalculadas por el servidor + tareas (files/03). */
@ApiTags('alerts')
@Controller()
export class AlertsController {
  constructor(private readonly alerts: AlertsService) {}

  @Get('alerts')
  @Perm('VER')
  @ApiQuery({ name: 'nivel', required: false, description: 'critica|riesgo|proxima|informativa' })
  @ApiQuery({ name: 'estado', required: false, description: 'Nueva|Leída|Delegada|Resuelta' })
  @ApiQuery({ name: 'contractId', required: false })
  @ApiOperation({ summary: 'Alertas calculadas en el servidor con su gestión' })
  listar(@Query() query: Record<string, unknown>) {
    return this.alerts.listar(query);
  }

  @Post('alerts/recalc')
  @Perm('EDITAR')
  @ApiOperation({ summary: 'Fuerza el recálculo de alertas (marca claves nuevas por cruce de umbral)' })
  recalcular() {
    return this.alerts.recalcular();
  }

  @Post('alerts/:key/read')
  @Perm('VER')
  @ApiOperation({ summary: 'Marcar como leída (la clave lleva |; codificar como %7C)' })
  marcarLeida(@Param('key') key: string, @CurrentUser() u: UsuarioInfo, @Req() req: Request) {
    return this.alerts.marcarLeida(decodeURIComponent(key), contextoDe(req, u));
  }

  @Post('alerts/:key/resolve')
  @Perm('EDITAR')
  @ApiOperation({ summary: 'Resolver con { nota } (permiso EDITAR)' })
  resolver(@Param('key') key: string, @Body() dto: ResolverAlertaDto, @CurrentUser() u: UsuarioInfo, @Req() req: Request) {
    return this.alerts.resolver(decodeURIComponent(key), dto.nota, contextoDe(req, u));
  }

  @Post('alerts/:key/delegate')
  @Perm('EDITAR')
  @ApiOperation({ summary: 'Delegar a { usuarioId } (permiso EDITAR; notifica al delegado en fase 3)' })
  delegar(@Param('key') key: string, @Body() dto: DelegarAlertaDto, @CurrentUser() u: UsuarioInfo, @Req() req: Request) {
    return this.alerts.delegar(decodeURIComponent(key), dto.usuarioId, contextoDe(req, u));
  }

  @Post('alerts/:key/tasks')
  @Perm('CREAR')
  @ApiOperation({ summary: 'Crear tarea desde la alerta { titulo, asignado, vence } (permiso CREAR)' })
  crearTarea(@Param('key') key: string, @Body() dto: CrearTareaDto, @CurrentUser() u: UsuarioInfo, @Req() req: Request) {
    return this.alerts.crearTareaDesdeAlerta(decodeURIComponent(key), dto, contextoDe(req, u));
  }

  @Get('tasks')
  @Perm('VER')
  @ApiOperation({ summary: 'Panel de tareas' })
  listarTareas() {
    return this.alerts.listarTareas();
  }

  @Put('tasks/:id')
  @Perm('EDITAR')
  @ApiOperation({ summary: 'Cerrar o reabrir una tarea' })
  async actualizarTarea(
    @Param('id') id: string,
    @Body() dto: ActualizarTareaDto,
    @CurrentUser() u: UsuarioInfo,
    @Req() req: Request,
  ): Promise<TaskEntity> {
    if (!dto.estado && dto.estado !== undefined) {
      throw new BadRequestException('Estado inválido.');
    }
    return this.alerts.actualizarTarea(id, dto, dto.version, contextoDe(req, u));
  }
}
