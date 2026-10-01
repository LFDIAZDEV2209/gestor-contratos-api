import {
  BadRequestException, Body, Controller, ForbiddenException, Get, Param, Post, Put, Query, Req, Res, UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { createReadStream, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DocumentsService } from './documents.service';
import { CrearDocumentoDto, ActualizarExtraidosDto, NuevaVersionDto } from './children.dto';
import { CurrentUser, Perm, UsuarioInfo } from '../../common/decorators';
import { contextoDe } from '../../common/req-context';
import { Request } from 'express';

@ApiTags('documents')
@Controller('documents')
export class DocumentsController {
  constructor(private readonly docs: DocumentsService) {}

  /** GET /contracts/:id/documents — con sus versiones. */
  @Get('by-contract/:contractId')
  @Perm('VER')
  listarPorContrato(@Param('contractId') contractId: string) {
    return this.docs.listarPorContrato(contractId);
  }

  @Post()
  @Perm('CREAR')
  @UseInterceptors(FileInterceptor('archivo'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        archivo: { type: 'string', format: 'binary' },
        contractId: { type: 'string' },
        nombre: { type: 'string' },
        categoria: { type: 'string' },
        obs: { type: 'string' },
        extracted: { type: 'string', description: 'JSON opcional (categoría Contrato)' },
      },
      required: ['archivo', 'contractId', 'nombre', 'categoria'],
    },
  })
  @ApiOperation({ summary: 'Crea un documento con su versión 1 (multipart)' })
  async crear(
    @Body() dto: CrearDocumentoDto & { extracted?: string },
    @UploadedFile() archivo: Express.Multer.File | undefined,
    @CurrentUser() u: UsuarioInfo,
    @Req() req: Request,
  ) {
    let extracted: Record<string, unknown> | undefined = dto.extracted as unknown as Record<string, unknown>;
    if (typeof dto.extracted === 'string') {
      try {
        extracted = JSON.parse(dto.extracted) as Record<string, unknown>;
      } catch {
        throw new BadRequestException('El campo extracted debe ser un JSON válido.');
      }
    }
    return this.docs.crear({ ...dto, extracted }, archivo, contextoDe(req, u));
  }

  @Post(':id/versions')
  @Perm('EDITAR')
  @UseInterceptors(FileInterceptor('archivo'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        archivo: { type: 'string', format: 'binary' },
        motivo: { type: 'string' },
        cambios: { type: 'string' },
      },
      required: ['archivo', 'motivo'],
    },
  })
  @ApiOperation({ summary: 'Nueva versión con motivo y cambios (las anteriores se conservan)' })
  nuevaVersion(
    @Param('id') id: string,
    @Body() dto: NuevaVersionDto,
    @UploadedFile() archivo: Express.Multer.File | undefined,
    @CurrentUser() u: UsuarioInfo,
    @Req() req: Request,
  ) {
    return this.docs.nuevaVersion(id, dto, archivo, contextoDe(req, u));
  }

  @Get(':id/versions/:v/file')
  @Perm('VER')
  @ApiOperation({ summary: 'Descarga el archivo de una versión (requiere URL firmada: token y exp)' })
  async descargar(
    @Param('id') id: string,
    @Param('v') v: string,
    @Query('token') token: string,
    @Query('exp') exp: string,
    @CurrentUser() u: UsuarioInfo,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    await this.docs.verificarToken(id, Number(v), token, exp);
    const ruta = await this.docs.rutaDeArchivo(id, Number(v));
    const dir = resolve(process.cwd(), process.env.UPLOAD_DIR ?? './data/uploads');
    const abs = join(dir, ruta);
    if (!existsSync(abs)) {
      throw new ForbiddenException('El archivo no está disponible en este servidor.');
    }
    createReadStream(abs).pipe(res);
  }
  @Post(':id/extract')
  @Perm('VER')
  @ApiOperation({ summary: 'Extracción OCR/IA (fase 5); hoy devuelve los datos extraídos existentes' })
  extraer(@Param('id') id: string, @CurrentUser() u: UsuarioInfo, @Req() req: Request) {
    return this.docs.extraer(id, contextoDe(req, u));
  }

  @Put(':id/extracted')
  @Perm('EDITAR')
  @ApiOperation({ summary: 'Corrección manual de los datos extraídos para la conciliación' })
  corregir(@Param('id') id: string, @Body() dto: ActualizarExtraidosDto, @CurrentUser() u: UsuarioInfo, @Req() req: Request) {
    return this.docs.corregirExtraidos(id, dto, contextoDe(req, u));
  }

  @Post(':id/void')
  @Perm('ANULAR')
  @ApiOperation({ summary: 'Anula el documento; las versiones se conservan' })
  async anular(@Param('id') id: string, @Body() body: { motivo: string }, @CurrentUser() u: UsuarioInfo, @Req() req: Request) {
    if (!body?.motivo || body.motivo.trim().length < 3) {
      throw new BadRequestException('El motivo de anulación es requerido.');
    }
    return this.docs.anular(id, body.motivo.trim(), contextoDe(req, u));
  }
}
