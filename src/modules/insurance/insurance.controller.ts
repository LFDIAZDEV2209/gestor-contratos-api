import { BadRequestException, Body, Controller, Get, Param, Post, Put, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { InsuranceService } from './insurance.service';
import { CrearGarantiaDto, ActualizarGarantiaDto, CrearCupoDto, ActualizarCupoDto } from './insurance.dto';
import { CurrentUser, Perm, UsuarioInfo } from '../../common/decorators';
import { contextoDe } from '../../common/req-context';
import { Request } from 'express';
import { GuaranteeEntity } from '../contracts/entities/guarantees.entity';
import { CupoEntity } from '../contracts/entities/quotas.entity';

/** Seguros: pólizas, aseguradoras y cupos (files/03 · sección seguros). */
@ApiTags('guarantees')
@Controller()
export class InsuranceController {
  constructor(private readonly insurance: InsuranceService) {}

  @Get('guarantees')
  @Perm('VER')
  @ApiQuery({ name: 'contractId', required: false })
  @ApiQuery({ name: 'aseguradora', required: false })
  @ApiQuery({ name: 'modalidadPoliza', required: false })
  @ApiQuery({ name: 'cupoId', required: false })
  @ApiQuery({ name: 'estado', required: false })
  @ApiQuery({ name: 'vencenEnDias', required: false })
  @ApiOperation({ summary: 'Pólizas con filtros' })
  listarGarantias(@Query() q: Record<string, unknown>) {
    return this.insurance.listarGarantias(q);
  }

  @Get('contracts/:contractId/guarantees')
  @Perm('VER')
  @ApiOperation({ summary: 'Pólizas de un contrato' })
  garantiasDeContrato(@Param('contractId') contractId: string) {
    return this.insurance.listarGarantias({ contractId }).then((r) => r.data);
  }

  @Post('guarantees')
  @Perm('CREAR')
  @ApiOperation({ summary: 'Crear póliza (aprobar si estado = Aprobada exige APROBAR; reglas de cupo de files/06)' })
  crearGarantia(
    @Body() dto: CrearGarantiaDto,
    @Query('force') force: string,
    @CurrentUser() u: UsuarioInfo,
    @Req() req: Request,
  ): Promise<GuaranteeEntity> {
    return this.insurance.crearGarantia(dto as unknown as Record<string, unknown>, contextoDe(req, u), force === 'true');
  }

  @Post('guarantees/:id/approve')
  @Perm('APROBAR')
  @ApiOperation({ summary: 'Aprobar póliza (permiso APROBAR)' })
  aprobarGarantia(@Param('id') id: string, @CurrentUser() u: UsuarioInfo, @Req() req: Request) {
    return this.insurance.aprobarGarantia(id, contextoDe(req, u));
  }

  @Put('guarantees/:id')
  @Perm('EDITAR')
  @ApiOperation({ summary: 'Actualizar póliza (version; cambiar a individual libera el cupo)' })
  actualizarGarantia(
    @Param('id') id: string,
    @Body() dto: ActualizarGarantiaDto,
    @Query('force') force: string,
    @CurrentUser() u: UsuarioInfo,
    @Req() req: Request,
  ): Promise<GuaranteeEntity> {
    return this.insurance.actualizarGarantia(id, dto as unknown as Record<string, unknown>, contextoDe(req, u), force === 'true');
  }

  @Post('guarantees/:id/void')
  @Perm('ANULAR')
  @ApiOperation({ summary: 'Anular póliza (libera su cupo)' })
  async anularGarantia(
    @Param('id') id: string,
    @Body() body: { motivo: string },
    @CurrentUser() u: UsuarioInfo,
    @Req() req: Request,
  ): Promise<GuaranteeEntity> {
    if (!body?.motivo || body.motivo.trim().length < 3) {
      throw new BadRequestException('El motivo de anulación es requerido.');
    }
    return this.insurance.anularGarantia(id, body.motivo.trim(), contextoDe(req, u));
  }

  @Get('insurers')
  @Perm('VER')
  @ApiOperation({ summary: 'Resumen por aseguradora (pólizas, valor, primas, cupos, vencimientos)' })
  insurers() {
    return this.insurance.resumenAseguradoras();
  }

  @Get('insurers/:nombre/policies')
  @Perm('VER')
  @ApiOperation({ summary: 'Pólizas de una aseguradora' })
  polizasPorAseguradora(@Param('nombre') nombre: string) {
    return this.insurance.polizasDe(decodeURIComponent(nombre));
  }

  @Get('quotas')
  @Perm('VER')
  @ApiOperation({ summary: 'Cupos con utilizado, disponible y % de uso calculados' })
  quotas() {
    return this.insurance.listarCupos();
  }

  @Post('quotas')
  @Perm('CREAR')
  crearCupo(@Body() dto: CrearCupoDto, @CurrentUser() u: UsuarioInfo, @Req() req: Request): Promise<CupoEntity> {
    return this.insurance.crearCupo(dto as unknown as Record<string, unknown>, contextoDe(req, u));
  }

  @Put('quotas/:id')
  @Perm('EDITAR')
  @ApiOperation({ summary: 'Editar cupo (advertencia si el valor queda por debajo de lo utilizado)' })
  actualizarCupo(
    @Param('id') id: string,
    @Body() dto: ActualizarCupoDto,
    @Query('force') force: string,
    @CurrentUser() u: UsuarioInfo,
    @Req() req: Request,
  ): Promise<CupoEntity> {
    return this.insurance.actualizarCupo(id, dto as unknown as Record<string, unknown>, contextoDe(req, u), force === 'true');
  }

  @Post('quotas/:id/void')
  @Perm('ANULAR')
  @ApiOperation({ summary: 'Anular cupo' })
  async anularCupo(
    @Param('id') id: string,
    @Body() body: { motivo: string },
    @CurrentUser() u: UsuarioInfo,
    @Req() req: Request,
  ): Promise<CupoEntity> {
    if (!body?.motivo || body.motivo.trim().length < 3) {
      throw new BadRequestException('El motivo de anulación es requerido.');
    }
    return this.insurance.anularCupo(id, body.motivo.trim(), contextoDe(req, u));
  }
}
