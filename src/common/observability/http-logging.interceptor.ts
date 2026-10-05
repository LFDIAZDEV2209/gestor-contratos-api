import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, catchError, tap } from 'rxjs';
import { Response } from 'express';
import { logStructured } from './logger';
import { RequestWithCorrelationId } from './correlation-id.middleware';

interface AuthenticatedRequest extends RequestWithCorrelationId {
  user?: { id?: string | number; sub?: string | number; role?: string; rol?: string; roles?: string[] };
}

@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<AuthenticatedRequest>();
    const res = http.getResponse<Response>();
    const startedAt = process.hrtime.bigint();
    const logRequest = (error?: unknown): void => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      const user = req.user;
      logStructured(durationMs > 500 ? 'warn' : 'info', 'http.request.completed', {
        requestId: req.requestId, userId: user?.id ?? user?.sub, rol: user?.rol ?? user?.role ?? user?.roles,
        metodo: req.method, ruta: req.originalUrl ?? req.url, status: res.statusCode,
        duracionMs: Number(durationMs.toFixed(2)),
        ...(error ? { error: error instanceof Error ? error.name : 'UnhandledError' } : {}),
      });
    };
    return next.handle().pipe(tap(() => logRequest()), catchError((error: unknown) => { logRequest(error); throw error; }));
  }
}
