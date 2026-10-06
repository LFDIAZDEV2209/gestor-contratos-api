import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHmac } from 'node:crypto';
import { extname } from 'node:path';
import { ConfigService } from '@nestjs/config';
import { DocumentEntity, DocumentVersionEntity } from './entities/documents.entity';
import { newId } from '../../common/ids';
import { hoyISO } from '../../common/dates';
import { NoEncontrado, Prohibido, Validacion } from '../../common/exceptions/api-exception';
import { ReqContext } from '../../common/req-context';
import { AuditService } from '../audit/audit.service';
import { RolesService } from '../roles/roles.service';
import { BlobStorageService } from '../../common/blob-storage';
import { DatosExtraidos } from '../../engines/reconcile.engine';

/**
 * Documentos por contrato con versiones inmutables (files/03):
 * multipart, URL firmada del archivo (S3 presigned en prod), extracción (fase 5) y anulación con historial.
 */
@Injectable()
export class DocumentsService {
  constructor(
    @InjectRepository(DocumentEntity) private readonly docs: Repository<DocumentEntity>,
    @InjectRepository(DocumentVersionEntity) private readonly versiones: Repository<DocumentVersionEntity>,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
    private readonly roles: RolesService,
    private readonly blobs: BlobStorageService,
  ) {}

  async listarPorContrato(contractId: string) {
    const [docs, vers] = await Promise.all([
      this.docs.find({ where: { contractId }, order: { createdAt: 'DESC' } }),
      this.versiones.find({ order: { v: 'DESC' } }),
    ]);
    const ids = new Set(docs.map((d) => d.id));
    return docs.map((d) => ({
      ...d,
      versions: vers.filter((v) => v.documentId === d.id && ids.has(d.id)).sort((a, b) => b.v - a.v),
    }));
  }

  async crear(
    dto: { contractId: string; nombre: string; categoria: string; obs?: string; extracted?: Record<string, unknown> },
    archivo: { originalname: string; buffer: Buffer; mimetype?: string } | undefined,
    ctx: ReqContext,
  ): Promise<DocumentEntity> {
    if (!archivo) throw new Validacion('El archivo del documento es requerido.', ['archivo']);
    const docId = newId('DOC');
    const ruta = await this.subirBlob(dto.contractId, docId, 1, archivo.originalname, archivo.buffer, archivo.mimetype);
    const doc = await this.docs.save(this.docs.create({
      id: docId,
      contractId: dto.contractId,
      nombre: dto.nombre,
      categoria: dto.categoria,
      estado: 'Activo',
      obs: dto.obs ?? null,
      extracted: dto.categoria === 'Contrato' ? ((dto.extracted ?? null) as DatosExtraidos | null) : null,
    }));
    await this.versiones.save(this.versiones.create({
      id: newId('DV'), documentId: doc.id, v: 1, fecha: hoyISO(), usuario: ctx.usuario, archivo: ruta,
      motivo: 'Carga inicial', cambios: null,
    }));
    await this.audit.registrar(ctx, [{
      contractId: doc.contractId, modulo: 'Documentos', accion: 'CREAR', nuevo: `${doc.nombre} (${doc.categoria})`,
    }]);
    return doc;
  }

  async nuevaVersion(
    id: string,
    dto: { motivo: string; cambios?: string },
    archivo: { originalname: string; buffer: Buffer; mimetype?: string } | undefined,
    ctx: ReqContext,
  ) {
    const doc = await this.obtener(id);
    if (doc.estado === 'Anulado') throw new Validacion('El documento está anulado.');
    if (!archivo) throw new Validacion('El archivo de la nueva versión es requerido.', ['archivo']);
    const max = await this.versiones.findOne({ where: { documentId: id }, order: { v: 'DESC' } });
    const v = (max?.v ?? 0) + 1;
    const ruta = await this.subirBlob(doc.contractId, id, v, archivo.originalname, archivo.buffer, archivo.mimetype);
    const version = await this.versiones.save(this.versiones.create({
      id: newId('DV'), documentId: id, v, fecha: hoyISO(), usuario: ctx.usuario, archivo: ruta,
      motivo: dto.motivo, cambios: dto.cambios ?? null,
    }));
    await this.audit.registrar(ctx, [{
      contractId: doc.contractId, modulo: 'Documentos', accion: 'VERSION', campo: 'v',
      anterior: String(max?.v ?? 0), nuevo: String(v), obs: dto.motivo,
    }]);
    return { documento: doc, version };
  }

  /** URL firmada temporal de descarga del archivo de una versión (S3 presigned en prod; HMAC en disco). */
  async urlFirmada(id: string, v: number): Promise<{ url: string; expira: string; enS3: boolean }> {
    const version = await this.versiones.findOne({ where: { documentId: id, v } });
    if (!version) throw new NotFoundException(`La versión ${v} del documento ${id} no existe.`);
    if (this.blobsEstaS3(version.archivo)) {
      const firm = await this.blobs.urlFirmadaGet(version.archivo, 600);
      return firm;
    }
    const exp = Math.floor(Date.now() / 1000) + 600; // 10 minutos
    const token = this.firmar(id, v, exp);
    const expira = new Date(exp * 1000).toISOString();
    return { url: `/api/documents/${id}/versions/${v}/file?token=${token}&exp=${exp}`, expira, enS3: false };
  }

  /** true si la clave de la versión está almacenada en S3 (prefijo contratos/). */
  private blobsEstaS3(clave: string): boolean {
    return clave.startsWith('contratos/');
  }

  async subirBlob(contractId: string, documentId: string, v: number, nombreOriginal: string, buffer: Buffer, mimeType?: string): Promise<string> {
    const nombre = `${newId('F')}${extname(nombreOriginal)}`;
    const clave = `contratos/${contractId}/${documentId}/${v}/${nombre}`;
    const res = await this.blobs.subir(clave, buffer, mimeType);
    return res.clave;
  }

  async verificarToken(id: string, v: number, token: string | undefined, exp: string | undefined): Promise<void> {
    if (!token || !exp) throw new Prohibido('URL firmada inválida.');
    const esperado = this.firmar(id, v, Number(exp));
    if (esperado !== token || Number(exp) * 1000 < Date.now()) {
      throw new Prohibido('La URL firmada expiró o es inválida.');
    }
  }

  rutaDeArchivo(id: string, v: number): Promise<string> {
    return this.versiones.findOne({ where: { documentId: id, v } }).then((x) => {
      if (!x) throw new NotFoundException(`La versión ${v} del documento ${id} no existe.`);
      return x.archivo;
    });
  }

  /**
   * Extracción OCR/IA de los datos del contrato (llega en fase 5).
   * Devuelve los datos extraídos existentes o la indicación de cargarlos a mano.
   */
  async extraer(id: string, ctx: ReqContext) {
    const doc = await this.obtener(id);
    if (doc.categoria !== 'Contrato') {
      throw new Validacion('Solo los documentos de categoría «Contrato» admiten extracción de datos.', ['categoria']);
    }
    await this.audit.registrar(ctx, [{
      contractId: doc.contractId, modulo: 'Documentos', accion: 'EXTRAER', obs: doc.nombre,
    }]);
    return {
      extracted: doc.extracted ?? null,
      mensaje: doc.extracted
        ? 'Datos extraídos disponibles para la conciliación.'
        : 'La extracción OCR/IA llega en la fase 5. Cargue los datos manualmente con PUT /documents/:id/extracted.',
    };
  }

  /** Corrección manual de los datos extraídos (permiso EDITAR). */
  async corregirExtraidos(id: string, dto: { extracted: Record<string, unknown>; version: number }, ctx: ReqContext): Promise<DocumentEntity> {
    const doc = await this.obtener(id);
    if (doc.categoria !== 'Contrato') {
      throw new Validacion('Solo los documentos de categoría «Contrato» admiten datos extraídos.', ['categoria']);
    }
    const prev = JSON.stringify(doc.extracted ?? null);
    doc.version = dto.version;
    doc.extracted = dto.extracted as DatosExtraidos;
    await this.docs.save(doc);
    await this.audit.registrar(ctx, [{
      contractId: doc.contractId, modulo: 'Documentos', accion: 'EDITAR', campo: 'extracted',
      anterior: prev, nuevo: JSON.stringify(dto.extracted), obs: 'Corrección manual de datos extraídos',
    }]);
    return doc;
  }

  async anular(id: string, motivo: string, ctx: ReqContext): Promise<DocumentEntity> {
    const doc = await this.obtener(id);
    if (doc.estado === 'Anulado') throw new Validacion('El documento ya está anulado.');
    doc.estado = 'Anulado';
    doc.motivoAnulacion = motivo;
    await this.docs.save(doc);
    await this.audit.registrar(ctx, [{
      contractId: doc.contractId, modulo: 'Documentos', accion: 'ANULAR', obs: motivo,
    }]);
    return doc;
  }

  private async obtener(id: string): Promise<DocumentEntity> {
    const doc = await this.docs.findOne({ where: { id } });
    if (!doc) throw new NoEncontrado(`El documento ${id}`);
    return doc;
  }

  private firmar(documentId: string, v: number, exp: number): string {
    const secreto = process.env.JWT_SECRET ?? 'cambia-este-secreto';
    return createHmac('sha256', secreto).update(`${documentId}|${v}|${exp}`).digest('hex');
  }
}
