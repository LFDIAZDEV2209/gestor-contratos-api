import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ObligationEntity, ObligationChecklistEntity, ObligationCommentEntity, ObligationEvidenceEntity,
} from './entities/obligations.entity';
import { newId } from '../../common/ids';
import { hoyISO } from '../../common/dates';
import { NoEncontrado, Validacion } from '../../common/exceptions/api-exception';
import { ReqContext } from '../../common/req-context';
import { AuditService } from '../audit/audit.service';
import { mkdir, writeFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { ConfigService } from '@nestjs/config';

/** Ficha completa de la obligación: checklist, comentarios y evidencias (files/03). */
@Injectable()
export class ObligacionesService {
  constructor(
    @InjectRepository(ObligationEntity) private readonly obls: Repository<ObligationEntity>,
    @InjectRepository(ObligationChecklistEntity) private readonly items: Repository<ObligationChecklistEntity>,
    @InjectRepository(ObligationCommentEntity) private readonly comentarios: Repository<ObligationCommentEntity>,
    @InjectRepository(ObligationEvidenceEntity) private readonly evidencias: Repository<ObligationEvidenceEntity>,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  async detalle(id: string) {
    const o = await this.obls.findOne({ where: { id } });
    if (!o) throw new NoEncontrado(`La obligación ${id}`);
    const [checklist, comentarios, evidencias] = await Promise.all([
      this.items.find({ where: { obligationId: id }, order: { orden: 'ASC', createdAt: 'ASC' } }),
      this.comentarios.find({ where: { obligationId: id }, order: { createdAt: 'ASC' } }),
      this.evidencias.find({ where: { obligationId: id }, order: { createdAt: 'ASC' } }),
    ]);
    return { obligation: o, checklist, comentarios, evidencias };
  }

  private async cargarObligacion(id: string): Promise<ObligationEntity> {
    const o = await this.obls.findOne({ where: { id } });
    if (!o) throw new NoEncontrado(`La obligación ${id}`);
    if (o.estado === 'Anulado') throw new Validacion('La obligación está anulada.');
    return o;
  }

  async agregarItemChecklist(id: string, dto: { texto: string; orden?: number }, ctx: ReqContext) {
    const o = await this.cargarObligacion(id);
    const item = await this.items.save(this.items.create({
      id: newId('CHK'), obligationId: id, texto: dto.texto, orden: dto.orden ?? 0, hecho: false,
    }));
    await this.audit.registrar(ctx, [{ contractId: o.contractId, modulo: 'Obligaciones', accion: 'CHECKLIST', nuevo: dto.texto }]);
    return item;
  }

  async alternarItem(id: string, itemId: string, dto: { hecho: boolean }, ctx: ReqContext) {
    const o = await this.cargarObligacion(id);
    const item = await this.items.findOne({ where: { id: itemId, obligationId: id } });
    if (!item) throw new NoEncontrado(`El ítem ${itemId}`);
    item.hecho = dto.hecho;
    await this.items.save(item);
    await this.audit.registrar(ctx, [{
      contractId: o.contractId, modulo: 'Obligaciones', accion: 'CHECKLIST',
      campo: itemId, nuevo: dto.hecho ? 'true' : 'false',
    }]);
    return item;
  }

  async comentar(id: string, dto: { texto: string }, ctx: ReqContext, usuario: string) {
    const o = await this.cargarObligacion(id);
    const c = await this.comentarios.save(this.comentarios.create({
      id: newId('OCO'), obligationId: id, usuario, texto: dto.texto,
    }));
    await this.audit.registrar(ctx, [{ contractId: o.contractId, modulo: 'Obligaciones', accion: 'COMENTARIO', nuevo: dto.texto.slice(0, 120) }]);
    return c;
  }

  async cargarEvidencia(id: string, archivo: { originalname: string; buffer: Buffer } | undefined, ctx: ReqContext, usuario: string) {
    const o = await this.cargarObligacion(id);
    if (!archivo) throw new Validacion('El archivo de la evidencia es requerido.', ['archivo']);
    const ruta = await this.guardarArchivo(archivo.originalname, archivo.buffer);
    const ev = await this.evidencias.save(this.evidencias.create({
      id: newId('OEV'), obligationId: id, nombre: archivo.originalname, archivo: ruta, usuario,
    }));
    await this.audit.registrar(ctx, [{ contractId: o.contractId, modulo: 'Obligaciones', accion: 'EVIDENCIA', nuevo: archivo.originalname }]);
    return ev;
  }

  /** Verificación de cumplimiento: requiere permiso APROBAR (guard en la ruta). */
  async verificar(id: string, dto: { estado: string; obs?: string }, ctx: ReqContext): Promise<ObligationEntity> {
    const o = await this.cargarObligacion(id);
    const prev = o.estado;
    o.estado = dto.estado;
    if (dto.obs !== undefined) o.obs = dto.obs;
    await this.obls.save(o);
    await this.audit.registrar(ctx, [{
      contractId: o.contractId, modulo: 'Obligaciones', accion: 'VERIFICAR',
      campo: 'estado', anterior: prev, nuevo: o.estado, obs: dto.obs ?? null,
    }]);
    return o;
  }

  private async guardarArchivo(nombreOriginal: string, buffer: Buffer): Promise<string> {
    const dir = resolve(process.cwd(), this.config.get<string>('uploadDir') ?? './data/uploads');
    await mkdir(dir, { recursive: true });
    const nombre = `${newId('F')}${extname(nombreOriginal)}`;
    await writeFile(join(dir, nombre), buffer);
    return nombre;
  }
}
