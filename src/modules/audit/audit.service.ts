import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createHash } from 'node:crypto';
import { AuditLogEntity } from './audit.entity';
import { ReqContext } from '../../common/req-context';
import { fechaHora } from '../../common/dates';

export interface EntradaAuditoria {
  contractId?: string | null;
  modulo: string;
  accion: string;
  campo?: string | null;
  anterior?: string | null;
  nuevo?: string | null;
  obs?: string | null;
}

/**
 * Auditoría INSERT-only (files/08): cada registro se congela al crearse,
 * lleva la IP real del request y un hash encadenado para detectar manipulación.
 * La migración añade un trigger de BD que bloquea UPDATE y DELETE sobre audit_log.
 */
@Injectable()
export class AuditService {
  constructor(private readonly ds: DataSource) {}

  async registrar(ctx: ReqContext, entradas: EntradaAuditoria[]): Promise<void> {
    await this.ds.transaction((em) => this.registrarEn(em, ctx, entradas));
  }

  /** Variante para reutilizar una transacción del llamador (p. ej. modificaciones). */
  async registrarEn(em: import('typeorm').EntityManager, ctx: ReqContext, entradas: EntradaAuditoria[]): Promise<void> {
    if (!entradas.length) return;
    const repo = em.getRepository(AuditLogEntity);
    // Serializa escritores concurrentes: bloquea la última fila para encadenar el hash.
    const ultimo = await repo.findOne({ where: {}, order: { id: 'DESC' }, lock: { mode: 'pessimistic_read' } });
    let prev = ultimo?.hash ?? '';
    const ahora = new Date();
    const filas = entradas.map((e) => {
      const { fecha, hora } = fechaHora(ahora);
      const payload = [
        fecha, hora, ctx.usuario, ctx.rol, e.modulo, e.accion,
        e.campo ?? '', e.anterior ?? '', e.nuevo ?? '', e.obs ?? '',
      ].join('|');
      const hash = createHash('sha256').update(`${payload}|${prev}`).digest('hex');
      prev = hash;
      return repo.create({
        ts: ahora,
        fecha,
        hora,
        usuario: ctx.usuario,
        rol: ctx.rol,
        contractId: e.contractId ?? null,
        modulo: e.modulo,
        accion: e.accion,
        campo: e.campo ?? null,
        anterior: e.anterior ?? null,
        nuevo: e.nuevo ?? null,
        ip: ctx.ip,
        obs: e.obs ?? null,
        hash,
      });
    });
    await repo.insert(filas);
  }
}
