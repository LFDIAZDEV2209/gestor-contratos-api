import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Response } from 'express';
import { logStructured } from './logger';
import { RequestWithCorrelationId } from './correlation-id.middleware';

interface LogUser { id?: string | number; sub?: string | number; role?: string; rol?: string; roles?: string[] }

interface AuthenticatedRequest extends RequestWithCorrelationId {
  reqUser?: LogUser;
  user?: LogUser;
}

@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<AuthenticatedRequest>();
    const res = http.getResponse<Response>();
    const startedAt = process.hrtime.bigint();
    let requestError: unknown;
    // Nest's exception filter runs after the interceptor's error notification.
    // Wait for the response to finish so status and duration reflect the actual reply.
    res.once('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      const user = req.reqUser ?? req.user;
      // REVISIÓN C07: solo el pathname — el querystring puede contener tokens/secrets
      // aportados por el cliente y la redacción por nombre de propiedad no lo cubre.
      let ruta: string | undefined = req.originalUrl ?? req.url;
      const qIdx = ruta.indexOf('?');
      if (qIdx >= 0) { ruta = ruta.slice(0, qIdx); }
      logStructured(durationMs > 500 ? 'warn' : 'info', 'http.request.completed', {
        requestId: req.requestId, userId: user?.id ?? user?.sub, rol: user?.rol ?? user?.role ?? user?.roles,
        metodo: req.method, ruta, status: res.statusCode,
        duracionMs: Number(durationMs.toFixed(2)),
        ...(requestError ? { error: requestError instanceof Error ? requestError.name : 'UnhandledError' } : {}),
      });
    });
    return next.handle().pipe(tap({ error: (error: unknown) => { requestError = error; } }));
  }
}
