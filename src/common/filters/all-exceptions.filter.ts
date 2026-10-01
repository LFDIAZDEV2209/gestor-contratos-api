import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { OptimisticLockVersionMismatchError, QueryFailedError } from 'typeorm';
import { Response } from 'express';
import { ApiError, WarningRequiresConfirmation } from '../exceptions/api-exception';

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
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    const d = this.describir(exception);
    if (d.status >= 500) this.logger.error(d.message, exception instanceof Error ? exception.stack : undefined);
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
      return { status: 400, code: 'VALIDATION_ERROR', message: e.message };
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
