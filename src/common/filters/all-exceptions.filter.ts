import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import { OptimisticLockVersionMismatchError, QueryFailedError } from 'typeorm';
import { Response } from 'express';
import { ApiError, WarningRequiresConfirmation } from '../exceptions/api-exception';
import { RequestWithCorrelationId } from '../observability/correlation-id.middleware';
import { logStructured } from '../observability/logger';
import { exceptionDiagnostic } from '../observability/exception-diagnostic';

interface DescripcionError {
  status: number;
  code: string;
  message: string;
  fields?: string[];
  warnings?: string[];
}

/** Serializa toda excepción con la forma { error: { code, message, fields? } } de files/03. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    const d = this.describir(exception);
    if (d.status >= 500) {
      const req = host.switchToHttp().getRequest<RequestWithCorrelationId>();
      logStructured('error', 'http.request.failed', {
        requestId: req.requestId,
        status: d.status,
        diagnostic: exceptionDiagnostic(exception),
      });
      d.message = 'Error interno del servidor.';
      d.fields = undefined;
      d.warnings = undefined;
    }
    const cuerpo: { error: { code: string; message: string; fields?: string[]; warnings?: string[] } } = {
      error: { code: d.code, message: d.message },
    };
    if (d.fields?.length) cuerpo.error.fields = d.fields;
    if (d.warnings?.length) cuerpo.error.warnings = d.warnings;
    res.status(d.status).json(cuerpo);
  }

  private describir(e: unknown): DescripcionError {
    if (e instanceof ApiError) {
      const warnings = e instanceof WarningRequiresConfirmation ? e.warnings : undefined;
      return { status: e.getStatus(), code: e.code, message: e.message, fields: e.fields, warnings };
    }
    if (e instanceof OptimisticLockVersionMismatchError) {
      return {
        status: 409,
        code: 'CONFLICT',
        message: 'La versión del registro está desactualizada. Recargue el registro y vuelva a intentarlo.',
      };
    }
    if (e instanceof QueryFailedError) {
      const code = (e as unknown as { driverError?: { code?: string } }).driverError?.code;
      if (code === '23505') {
        return { status: 409, code: 'CONFLICT', message: 'Registro duplicado: ya existe un registro con el mismo valor único.' };
      }
      if (code === '23503') {
        return { status: 400, code: 'VALIDATION_ERROR', message: 'Referencia inválida: el registro relacionado no existe.' };
      }
      return { status: 500, code: 'INTERNAL_ERROR', message: 'Error interno del servidor.' };
    }
    if (e instanceof HttpException) {
      const status = e.getStatus();
      const resp = e.getResponse() as { code?: string; message?: string | string[] };
      const mensaje = Array.isArray(resp.message) ? resp.message.join('; ') : resp.message ?? e.message;
      const fields = Array.isArray(resp.message) ? resp.message : undefined;
      return { status, code: resp.code ?? codigoPorEstado(status), message: mensaje, fields };
    }
    return {
      status: 500,
      code: 'INTERNAL_ERROR',
      message: e instanceof Error ? e.message : 'Error interno del servidor.',
    };
  }
}

function codigoPorEstado(status: number): string {
  switch (status) {
    case 400: return 'VALIDATION_ERROR';
    case 401: return 'UNAUTHENTICATED';
    case 403: return 'FORBIDDEN';
    case 404: return 'NOT_FOUND';
    case 409: return 'CONFLICT';
    case 422: return 'WARNING_REQUIRES_CONFIRMATION';
    default: return `HTTP_${status}`;
  }
}
