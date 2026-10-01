import { Body, Controller, Get, Param, Post, Put, Req, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ObligacionesService } from './obligaciones.service';
import { ItemChecklistDto, ToggleChecklistDto, ComentarioDto, VerificarObligacionDto } from './children.dto';
import { CurrentUser, Perm, UsuarioInfo } from '../../common/decorators';
import { contextoDe } from '../../common/req-context';
import { Request } from 'express';

@ApiTags('obligations')
@Controller('obligations')
export class ObligacionesExtrasController {
  constructor(private readonly svc: ObligacionesService) {}

  @Get(':id')
  @Perm('VER')
  @ApiOperation({ summary: 'Ficha de la obligación con checklist, comentarios y evidencias' })
  detalle(@Param('id') id: string) {
    return this.svc.detalle(id);
  }

  @Post(':id/checklist')
  @Perm('EDITAR')
  @ApiOperation({ summary: 'Agrega un ítem al checklist' })
  agregarItem(@Param('id') id: string, @Body() dto: ItemChecklistDto, @CurrentUser() u: UsuarioInfo, @Req() req: Request) {
    return this.svc.agregarItemChecklist(id, dto, contextoDe(req, u));
  }

  @Put(':id/checklist/:itemId')
  @Perm('EDITAR')
  @ApiOperation({ summary: 'Marca o desmarca un ítem del checklist' })
  alternarItem(@Param('id') id: string, @Param('itemId') itemId: string, @Body() dto: ToggleChecklistDto, @CurrentUser() u: UsuarioInfo, @Req() req: Request) {
    return this.svc.alternarItem(id, itemId, dto, contextoDe(req, u));
  }

  @Post(':id/comments')
  @Perm('EDITAR')
  @ApiOperation({ summary: 'Comenta la obligación' })
  comentar(@Param('id') id: string, @Body() dto: ComentarioDto, @CurrentUser() u: UsuarioInfo, @Req() req: Request) {
    return this.svc.comentar(id, dto, contextoDe(req, u), u.nombre);
  }

  @Post(':id/evidences')
  @Perm('EDITAR')
  @UseInterceptors(FileInterceptor('archivo'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { archivo: { type: 'string', format: 'binary' } } } })
  @ApiOperation({ summary: 'Carga una evidencia (multipart)' })
  cargarEvidencia(
    @Param('id') id: string,
    @UploadedFile() archivo: Express.Multer.File | undefined,
    @CurrentUser() u: UsuarioInfo,
    @Req() req: Request,
  ) {
    return this.svc.cargarEvidencia(id, archivo, contextoDe(req, u), u.nombre);
  }

  @Post(':id/verify')
  @Perm('APROBAR')
  @ApiOperation({ summary: 'Verifica el cumplimiento (permiso APROBAR)' })
  verificar(@Param('id') id: string, @Body() dto: VerificarObligacionDto, @CurrentUser() u: UsuarioInfo, @Req() req: Request) {
    return this.svc.verificar(id, dto, contextoDe(req, u));
  }
}
