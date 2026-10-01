import { BadRequestException, Body, Controller, Get, Param, Post, Put, Query, Req } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ContractsService, FilaContrato } from './contracts.service';
import { CrearContratoDto } from './contracts.dto';
import { DocumentsService } from './documents.service';
import { AuditLogEntity } from '../audit/audit.entity';
import { CurrentUser, Perm, UsuarioInfo } from '../../common/decorators';
import { contextoDe } from '../../common/req-context';
import { Request } from 'express';
import { paginar, leerPagina } from '../../common/pagination';

/** Contratos (files/03): lista con métricas, expediente, validador, conciliación y auditoría. */
@ApiTags('contracts')
@Controller('contracts')
export class ContractsController {
  constructor(
    private readonly contracts: ContractsService,
    private readonly documentsService: DocumentsService,
    @InjectRepository(AuditLogEntity) private readonly auditRepo: Repository<AuditLogEntity>,
  ) {}

  @Get()
  @Perm('VER')
  @ApiOperation({ summary: 'Lista con métricas M(c), semáforo y filtros' })
  @ApiQuery({ name: 'q', required: false })
  @ApiQuery({ name: 'companyId', required: false })
  @ApiQuery({ name: 'estado', required: false })
  @ApiQuery({ name: 'tipo', required: false })
  @ApiQuery({ name: 'anio', required: false })
  @ApiQuery({ name: 'responsable', required: false })
  @ApiQuery({ name: 'supervisor', required: false })
  @ApiQuery({ name: 'depto', required: false, description: 'código DANE' })
  @ApiQuery({ name: 'region', required: false, description: 'Caribe|Andina|Pacífica|Orinoquía|Amazonía|Insular' })
  @ApiQuery({ name: 'aseguradora', required: false })
  @ApiQuery({ name: 'nivel', required: false, description: 'normal|atencion|riesgo|critico|info' })
  @ApiQuery({ name: 'vencidos', required: false })
  @ApiQuery({ name: 'proximos', required: false, description: 'días' })
  @ApiQuery({ name: 'garantiasVencidas', required: false })
  @ApiQuery({ name: 'multiAseguradoras', required: false })
  @ApiQuery({ name: 'incluirAnulados', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  listar(@Query() query: Record<string, unknown>) {
    return this.contracts.listar(query as never);
  }

  @Get(':id')
  @Perm('VER')
  @ApiOperation({ summary: 'Detalle con métricas, semáforo, razones e índice de control' })
  obtener(@Param('id') id: string): Promise<FilaContrato> {
    return this.contracts.obtener(id);
  }

  @Get(':id/documents')
  @Perm('VER')
  @ApiOperation({ summary: 'Documentos del contrato con sus versiones' })
  documentos(@Param('id') id: string) {
    return this.documentsService.listarPorContrato(id);
  }

  @Post()
  @Perm('CREAR')
  @ApiOperation({ summary: 'Crear (Validator.draft en servidor; advertencias se aceptan con ?force=true)' })
  async crear(
    @Body() dto: CrearContratoDto,
    @Query('force') force: string,
    @CurrentUser() u: UsuarioInfo,
    @Req() req: Request,
  ): Promise<FilaContrato> {
    return this.contracts.crear(dto, contextoDe(req, u), force === 'true');
  }

  @Put(':id')
  @Perm('EDITAR')
  @ApiOperation({ summary: 'Actualizar con bloqueo optimista (version) — audita campo por campo' })
  actualizar(
    @Param('id') id: string,
    @Body() dto: CrearContratoDto & { version: number },
    @Query('force') force: string,
    @CurrentUser() u: UsuarioInfo,
    @Req() req: Request,
  ): Promise<FilaContrato> {
    return this.contracts.actualizar(id, dto, contextoDe(req, u), force === 'true');
  }

  @Post(':id/void')
  @Perm('ANULAR')
  @ApiOperation({ summary: 'Anular con { motivo } — no existe borrado físico' })
  async anular(
    @Param('id') id: string,
    @Body() body: { motivo: string },
    @CurrentUser() u: UsuarioInfo,
    @Req() req: Request,
  ): Promise<FilaContrato> {
    if (!body?.motivo || body.motivo.trim().length < 3) {
      throw new BadRequestException('El motivo de anulación es requerido.');
    }
    return this.contracts.anular(id, body.motivo.trim(), contextoDe(req, u));
  }

  @Post(':id/validate')
  @Perm('VER')
  @ApiOperation({ summary: 'Ejecuta el validador integral (13 áreas)' })
  validar(@Param('id') id: string, @CurrentUser() u: UsuarioInfo, @Req() req: Request) {
    return this.contracts.validar(id, contextoDe(req, u));
  }

  @Get(':id/reconcile')
  @Perm('VER')
  @ApiOperation({ summary: 'Conciliación sistema vs. documento firmado' })
  conciliar(@Param('id') id: string, @CurrentUser() u: UsuarioInfo, @Req() req: Request) {
    return this.contracts.conciliar(id, contextoDe(req, u));
  }

  @Get(':id/timeline')
  @Perm('VER')
  @ApiOperation({ summary: 'Historial de eventos del contrato' })
  timeline(@Param('id') id: string) {
    return this.contracts.timeline(id);
  }

  @Get(':id/audit')
  @Perm('AUDITAR')
  @ApiOperation({ summary: 'Auditoría del contrato (permiso AUDITAR)' })
  async auditar(@Param('id') id: string, @Query() q: Record<string, unknown>) {
    const { page, pageSize } = leerPagina(q, 50);
    const qb = this.auditRepo.createQueryBuilder('a').where('a.contractId = :id', { id });
    if (q.usuario) qb.andWhere('a.usuario = :usuario', { usuario: q.usuario });
    if (q.accion) qb.andWhere('a.accion = :accion', { accion: q.accion });
    if (q.modulo) qb.andWhere('a.modulo = :modulo', { modulo: q.modulo });
    if (q.desde && q.hasta) {
      qb.andWhere('a.fecha BETWEEN :desde AND :hasta', { desde: q.desde, hasta: q.hasta });
    }
    const total = await qb.getCount();
    const data = await qb.orderBy('a.id', 'DESC').skip((page - 1) * pageSize).take(pageSize).getMany();
    return paginar(data, total, page, pageSize);
  }

  @Post(':id/notify')
  @Perm('VER')
  @ApiOperation({ summary: 'Envío de alerta al responsable (canales de correo/WhatsApp llegan en fase 3)' })
  async notificar(@Param('id') id: string, @CurrentUser() u: UsuarioInfo, @Req() req: Request) {
    const c = await this.contracts.obtener(id);
    await this.contracts.registrarNotificacion(c.responsable, id, contextoDe(req, u));
    return {
      notificado: false,
      mensaje: 'El envío por correo/WhatsApp se activa en la fase 3. La solicitud quedó en auditoría.',
    };
  }
}
