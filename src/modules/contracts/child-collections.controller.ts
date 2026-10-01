import {
  BadRequestException, Body, Controller, Get, NotFoundException, Param, Post, Put, Query, Req,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ChildCollectionsService } from './child-collections.service';
import { CurrentUser, Perm, UsuarioInfo } from '../../common/decorators';
import { contextoDe, ReqContext } from '../../common/req-context';
import { Request } from 'express';
import {
  CrearSubcontratoDto, ActualizarSubcontratoDto, CrearObligacionDto, ActualizarObligacionDto,
  CrearEntregableDto, ActualizarEntregableDto, CrearEjecucionDto, ActualizarEjecucionDto,
  CrearPagoDto, ActualizarPagoDto, CrearActaDto, ActualizarActaDto, CrearModificacionDto,
  CrearRiesgoDto, ActualizarRiesgoDto, CrearIncumplimientoDto, ActualizarIncumplimientoDto,
  CrearPlanDto, ActualizarPlanDto,
} from './children.dto';

/** Guard clause de motivo para anulación. */
function motivoValido(body: { motivo?: string } | undefined): string {
  if (!body?.motivo || body.motivo.trim().length < 3) {
    throw new BadRequestException('El motivo de anulación es requerido.');
  }
  return body.motivo.trim();
}

/**
 * Rutas de las 10 colecciones hijas del contrato (guarantees y documents tienen
 * módulo propio). Rutas explícitas (sin catch-all) para control total del
 * enrutador: ver → GET · crear → POST · editar → PUT · anular → POST /void.
 */
@ApiTags('contratos · colecciones hijas')
@Controller()
export class ChildCollectionsController {
  constructor(private readonly col: ChildCollectionsService) {}

  /* ── Subcontratos ─────────────────────────────────────────────────────── */

  @Get('subcontracts')
  @Perm('VER')
  listarSubcontratos(@Query() q: Record<string, unknown>) {
    return this.col.listar('subcontracts', q);
  }

  @Get('contracts/:contractId/subcontracts')
  @Perm('VER')
  subcontratosDe(@Param('contractId') contractId: string) {
    return this.col.listarPorContrato('subcontracts', contractId);
  }

  @Post('subcontracts')
  @Perm('CREAR')
  crearSubcontrato(@Body() dto: CrearSubcontratoDto, @CurrentUser() u: UsuarioInfo, @Req() req: Request) {
    return this.col.crear('subcontracts', dto as unknown as Record<string, unknown>, contextoDe(req, u), false);
  }

  @Put('subcontracts/:id')
  @Perm('EDITAR')
  actualizarSubcontrato(@Param('id') id: string, @Body() dto: ActualizarSubcontratoDto, @CurrentUser() u: UsuarioInfo, @Req() req: Request, @Query('force') force: string) {
    return this.col.actualizar('subcontracts', id, dto as unknown as Record<string, unknown>, contextoDe(req, u), force === 'true');
  }

  @Post('subcontracts/:id/void')
  @Perm('ANULAR')
  anularSubcontrato(@Param('id') id: string, @Body() body: { motivo: string }, @CurrentUser() u: UsuarioInfo, @Req() req: Request) {
    return this.col.anular('subcontracts', id, motivoValido(body), contextoDe(req, u));
  }

  /* ── Obligaciones ─────────────────────────────────────────────────────── */

  @Get('obligations')
  @Perm('VER')
  listarObligaciones(@Query() q: Record<string, unknown>) {
    return this.col.listar('obligations', q);
  }

  @Get('contracts/:contractId/obligations')
  @Perm('VER')
  obligacionesDe(@Param('contractId') contractId: string) {
    return this.col.listarPorContrato('obligations', contractId);
  }

  @Post('obligations')
  @Perm('CREAR')
  crearObligacion(@Body() dto: CrearObligacionDto, @CurrentUser() u: UsuarioInfo, @Req() req: Request) {
    return this.col.crear('obligations', dto as unknown as Record<string, unknown>, contextoDe(req, u), false);
  }

  @Put('obligations/:id')
  @Perm('EDITAR')
  actualizarObligacion(@Param('id') id: string, @Body() dto: ActualizarObligacionDto, @CurrentUser() u: UsuarioInfo, @Req() req: Request, @Query('force') force: string) {
    return this.col.actualizar('obligations', id, dto as unknown as Record<string, unknown>, contextoDe(req, u), force === 'true');
  }

  @Post('obligations/:id/void')
  @Perm('ANULAR')
  anularObligacion(@Param('id') id: string, @Body() body: { motivo: string }, @CurrentUser() u: UsuarioInfo, @Req() req: Request) {
    return this.col.anular('obligations', id, motivoValido(body), contextoDe(req, u));
  }

  /* ── Entregables ──────────────────────────────────────────────────────── */

  @Get('deliverables')
  @Perm('VER')
  listarEntregables(@Query() q: Record<string, unknown>) {
    return this.col.listar('deliverables', q);
  }

  @Get('contracts/:contractId/deliverables')
  @Perm('VER')
  entregablesDe(@Param('contractId') contractId: string) {
    return this.col.listarPorContrato('deliverables', contractId);
  }

  @Post('deliverables')
  @Perm('CREAR')
  crearEntregable(@Body() dto: CrearEntregableDto, @CurrentUser() u: UsuarioInfo, @Req() req: Request) {
    return this.col.crear('deliverables', dto as unknown as Record<string, unknown>, contextoDe(req, u), false);
  }

  @Put('deliverables/:id')
  @Perm('EDITAR')
  actualizarEntregable(@Param('id') id: string, @Body() dto: ActualizarEntregableDto, @CurrentUser() u: UsuarioInfo, @Req() req: Request, @Query('force') force: string) {
    return this.col.actualizar('deliverables', id, dto as unknown as Record<string, unknown>, contextoDe(req, u), force === 'true');
  }

  @Post('deliverables/:id/void')
  @Perm('ANULAR')
  anularEntregable(@Param('id') id: string, @Body() body: { motivo: string }, @CurrentUser() u: UsuarioInfo, @Req() req: Request) {
    return this.col.anular('deliverables', id, motivoValido(body), contextoDe(req, u));
  }

  /* ── Ejecución mensual ────────────────────────────────────────────────── */

  @Get('execs')
  @Perm('VER')
  listarEjecuciones(@Query() q: Record<string, unknown>) {
    return this.col.listar('execs', q);
  }

  @Get('contracts/:contractId/execs')
  @Perm('VER')
  ejecucionesDe(@Param('contractId') contractId: string) {
    return this.col.listarPorContrato('execs', contractId);
  }

  @Post('execs')
  @Perm('CREAR')
  crearEjecucion(@Body() dto: CrearEjecucionDto, @CurrentUser() u: UsuarioInfo, @Req() req: Request, @Query('force') force: string) {
    return this.col.crear('execs', dto as unknown as Record<string, unknown>, contextoDe(req, u), force === 'true');
  }

  @Put('execs/:id')
  @Perm('EDITAR')
  actualizarEjecucion(@Param('id') id: string, @Body() dto: ActualizarEjecucionDto, @CurrentUser() u: UsuarioInfo, @Req() req: Request, @Query('force') force: string) {
    return this.col.actualizar('execs', id, dto as unknown as Record<string, unknown>, contextoDe(req, u), force === 'true');
  }

  @Post('execs/:id/void')
  @Perm('ANULAR')
  anularEjecucion(@Param('id') id: string, @Body() body: { motivo: string }, @CurrentUser() u: UsuarioInfo, @Req() req: Request) {
    return this.col.anular('execs', id, motivoValido(body), contextoDe(req, u));
  }

  /* ── Pagos ────────────────────────────────────────────────────────────── */

  @Get('payments')
  @Perm('VER')
  listarPagos(@Query() q: Record<string, unknown>) {
    return this.col.listar('payments', q);
  }

  @Get('contracts/:contractId/payments')
  @Perm('VER')
  pagosDe(@Param('contractId') contractId: string) {
    return this.col.listarPorContrato('payments', contractId);
  }

  @Post('payments')
  @Perm('CREAR')
  crearPago(@Body() dto: CrearPagoDto, @CurrentUser() u: UsuarioInfo, @Req() req: Request) {
    return this.col.crear('payments', dto as unknown as Record<string, unknown>, contextoDe(req, u), false);
  }

  @Put('payments/:id')
  @Perm('EDITAR')
  actualizarPago(@Param('id') id: string, @Body() dto: ActualizarPagoDto, @CurrentUser() u: UsuarioInfo, @Req() req: Request, @Query('force') force: string) {
    return this.col.actualizar('payments', id, dto as unknown as Record<string, unknown>, contextoDe(req, u), force === 'true');
  }

  @Post('payments/:id/void')
  @Perm('ANULAR')
  anularPago(@Param('id') id: string, @Body() body: { motivo: string }, @CurrentUser() u: UsuarioInfo, @Req() req: Request) {
    return this.col.anular('payments', id, motivoValido(body), contextoDe(req, u));
  }

  /* ── Actas ────────────────────────────────────────────────────────────── */

  @Get('actas')
  @Perm('VER')
  listarActas(@Query() q: Record<string, unknown>) {
    return this.col.listar('actas', q);
  }

  @Get('contracts/:contractId/actas')
  @Perm('VER')
  actasDe(@Param('contractId') contractId: string) {
    return this.col.listarPorContrato('actas', contractId);
  }

  @Post('actas')
  @Perm('CREAR')
  crearActa(@Body() dto: CrearActaDto, @CurrentUser() u: UsuarioInfo, @Req() req: Request) {
    return this.col.crear('actas', dto as unknown as Record<string, unknown>, contextoDe(req, u), false);
  }

  @Put('actas/:id')
  @Perm('EDITAR')
  actualizarActa(@Param('id') id: string, @Body() dto: ActualizarActaDto, @CurrentUser() u: UsuarioInfo, @Req() req: Request, @Query('force') force: string) {
    return this.col.actualizar('actas', id, dto as unknown as Record<string, unknown>, contextoDe(req, u), force === 'true');
  }

  @Post('actas/:id/void')
  @Perm('ANULAR')
  anularActa(@Param('id') id: string, @Body() body: { motivo: string }, @CurrentUser() u: UsuarioInfo, @Req() req: Request) {
    return this.col.anular('actas', id, motivoValido(body), contextoDe(req, u));
  }

  /* ── Modificaciones (inmutables: crear/anular) ────────────────────────── */

  @Get('modifications')
  @Perm('VER')
  listarModificaciones(@Query() q: Record<string, unknown>) {
    return this.col.listar('modifications', q);
  }

  @Get('contracts/:contractId/modifications')
  @Perm('VER')
  modificacionesDe(@Param('contractId') contractId: string) {
    return this.col.listarPorContrato('modifications', contractId);
  }

  @Post('modifications')
  @Perm('CREAR')
  crearModificacion(
    @Body() dto: CrearModificacionDto,
    @Query('force') force: string,
    @CurrentUser() u: UsuarioInfo,
    @Req() req: Request,
  ) {
    return this.col.crear('modifications', dto as unknown as Record<string, unknown>, contextoDe(req, u), force === 'true');
  }

  @Post('modifications/:id/void')
  @Perm('ANULAR')
  anularModificacion(@Param('id') id: string, @Body() body: { motivo: string }, @CurrentUser() u: UsuarioInfo, @Req() req: Request) {
    return this.col.anular('modifications', id, motivoValido(body), contextoDe(req, u));
  }

  /* ── Riesgos ──────────────────────────────────────────────────────────── */

  @Get('risks')
  @Perm('VER')
  listarRiesgos(@Query() q: Record<string, unknown>) {
    return this.col.listar('risks', q);
  }

  @Get('contracts/:contractId/risks')
  @Perm('VER')
  riesgosDe(@Param('contractId') contractId: string) {
    return this.col.listarPorContrato('risks', contractId);
  }

  @Post('risks')
  @Perm('CREAR')
  crearRiesgo(@Body() dto: CrearRiesgoDto, @CurrentUser() u: UsuarioInfo, @Req() req: Request) {
    return this.col.crear('risks', dto as unknown as Record<string, unknown>, contextoDe(req, u), false);
  }

  @Put('risks/:id')
  @Perm('EDITAR')
  actualizarRiesgo(@Param('id') id: string, @Body() dto: ActualizarRiesgoDto, @CurrentUser() u: UsuarioInfo, @Req() req: Request, @Query('force') force: string) {
    return this.col.actualizar('risks', id, dto as unknown as Record<string, unknown>, contextoDe(req, u), force === 'true');
  }

  @Post('risks/:id/void')
  @Perm('ANULAR')
  anularRiesgo(@Param('id') id: string, @Body() body: { motivo: string }, @CurrentUser() u: UsuarioInfo, @Req() req: Request) {
    return this.col.anular('risks', id, motivoValido(body), contextoDe(req, u));
  }

  /* ── Incumplimientos ──────────────────────────────────────────────────── */

  @Get('breaches')
  @Perm('VER')
  listarIncumplimientos(@Query() q: Record<string, unknown>) {
    return this.col.listar('breaches', q);
  }

  @Get('contracts/:contractId/breaches')
  @Perm('VER')
  incumplimientosDe(@Param('contractId') contractId: string) {
    return this.col.listarPorContrato('breaches', contractId);
  }

  @Post('breaches')
  @Perm('CREAR')
  crearIncumplimiento(@Body() dto: CrearIncumplimientoDto, @CurrentUser() u: UsuarioInfo, @Req() req: Request) {
    return this.col.crear('breaches', dto as unknown as Record<string, unknown>, contextoDe(req, u), false);
  }

  @Put('breaches/:id')
  @Perm('EDITAR')
  actualizarIncumplimiento(@Param('id') id: string, @Body() dto: ActualizarIncumplimientoDto, @CurrentUser() u: UsuarioInfo, @Req() req: Request, @Query('force') force: string) {
    return this.col.actualizar('breaches', id, dto as unknown as Record<string, unknown>, contextoDe(req, u), force === 'true');
  }

  @Post('breaches/:id/void')
  @Perm('ANULAR')
  anularIncumplimiento(@Param('id') id: string, @Body() body: { motivo: string }, @CurrentUser() u: UsuarioInfo, @Req() req: Request) {
    return this.col.anular('breaches', id, motivoValido(body), contextoDe(req, u));
  }

  /* ── Planes de mejoramiento ───────────────────────────────────────────── */

  @Get('plans')
  @Perm('VER')
  listarPlanes(@Query() q: Record<string, unknown>) {
    return this.col.listar('plans', q);
  }

  @Get('contracts/:contractId/plans')
  @Perm('VER')
  planesDe(@Param('contractId') contractId: string) {
    return this.col.listarPorContrato('plans', contractId);
  }

  @Post('plans')
  @Perm('CREAR')
  crearPlan(@Body() dto: CrearPlanDto, @CurrentUser() u: UsuarioInfo, @Req() req: Request) {
    return this.col.crear('plans', dto as unknown as Record<string, unknown>, contextoDe(req, u), false);
  }

  @Put('plans/:id')
  @Perm('EDITAR')
  actualizarPlan(@Param('id') id: string, @Body() dto: ActualizarPlanDto, @CurrentUser() u: UsuarioInfo, @Req() req: Request, @Query('force') force: string) {
    return this.col.actualizar('plans', id, dto as unknown as Record<string, unknown>, contextoDe(req, u), force === 'true');
  }

  @Post('plans/:id/void')
  @Perm('ANULAR')
  anularPlan(@Param('id') id: string, @Body() body: { motivo: string }, @CurrentUser() u: UsuarioInfo, @Req() req: Request) {
    return this.col.anular('plans', id, motivoValido(body), contextoDe(req, u));
  }
}
