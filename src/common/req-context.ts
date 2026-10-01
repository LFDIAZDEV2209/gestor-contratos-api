import { Request } from 'express';
import { UsuarioInfo } from './decorators';

/** Contexto de petición para la auditoría: usuario real + IP real del request. */
export interface ReqContext {
  usuarioId: string;
  usuario: string;
  rol: string;
  ip: string;
}

/** IP real: X-Forwarded-For (primer valor) → X-Real-IP → req.ip. */
export function ipReal(req: Request): string {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length) return xff.split(',')[0].trim();
  const xri = req.headers['x-real-ip'];
  if (typeof xri === 'string' && xri.length) return xri;
  return req.ip ?? req.socket?.remoteAddress ?? '';
}

export function contextoDe(req: Request, user: UsuarioInfo): ReqContext {
  return { usuarioId: user.id, usuario: user.nombre, rol: user.rol, ip: ipReal(req) };
}
