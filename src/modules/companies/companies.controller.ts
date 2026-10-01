import { BadRequestException, Body, Controller, Get, Param, Post, Put, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CompaniesService } from './companies.service';
import { CrearEmpresaDto, ActualizarEmpresaDto } from './dto';
import { CurrentUser, Perm, UsuarioInfo } from '../../common/decorators';
import { contextoDe } from '../../common/req-context';
import { Request } from 'express';
import { CompanyEntity } from './companies.entity';

@ApiTags('companies')
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companies: CompaniesService) {}

  @Get()
  @Perm('VER')
  @ApiOperation({ summary: 'Lista de empresas (filtros: estado, q)' })
  listar(@Query() query: Record<string, unknown>) {
    return this.companies.listar(query);
  }

  @Get(':id')
  @Perm('VER')
  @ApiOperation({ summary: 'Detalle con indicadores (contratos, valor, ejecutado, saldo)' })
  obtener(@Param('id') id: string) {
    return this.companies.obtenerConIndicadores(id);
  }

  @Post()
  @Perm('CREAR')
  crear(@Body() dto: CrearEmpresaDto, @CurrentUser() u: UsuarioInfo, @Req() req: Request): Promise<CompanyEntity> {
    return this.companies.crear(dto, contextoDe(req, u));
  }

  @Put(':id')
  @Perm('EDITAR')
  actualizar(
    @Param('id') id: string,
    @Body() dto: ActualizarEmpresaDto,
    @CurrentUser() u: UsuarioInfo,
    @Req() req: Request,
  ): Promise<CompanyEntity> {
    return this.companies.actualizar(id, dto, dto.version, contextoDe(req, u));
  }

  @Post(':id/void')
  @Perm('ANULAR')
  @ApiOperation({ summary: 'Anular empresa → estado Inactiva con motivo' })
  anular(
    @Param('id') id: string,
    @Body() body: { motivo: string },
    @CurrentUser() u: UsuarioInfo,
    @Req() req: Request,
  ): Promise<CompanyEntity> {
    if (!body?.motivo || body.motivo.trim().length < 3) {
      throw new BadRequestException('El motivo de anulación es requerido.');
    }
    return this.companies.anular(id, body.motivo.trim(), contextoDe(req, u));
  }
}
