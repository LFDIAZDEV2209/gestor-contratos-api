import { HttpException } from '@nestjs/common';

/**
 * Error de dominio con la forma de files/03:
 * { error: { code, message, fields? } } y códigos VALIDATION_ERROR,
 * UNAUTHENTICATED, FORBIDDEN, NOT_FOUND, CONFLICT, WARNING_REQUIRES_CONFIRMATION.
 */
export class ApiError extends HttpException {
  readonly code: string;
  readonly fields?: string[];

  constructor(status: number, code: string, message: string, fields?: string[]) {
    super({ code, message, fields }, status);
    this.code = code;
    this.fields = fields;
  }
}

/** Advertencia aceptable: 422; se reenvía con ?force=true («Registrar de todas formas»). */
export class WarningRequiresConfirmation extends ApiError {
  readonly warnings: string[];

  constructor(message: string, warnings: string[], fields?: string[]) {
    super(422, 'WARNING_REQUIRES_CONFIRMATION', message, fields);
    this.warnings = warnings;
  }
}

export class NoEncontrado extends ApiError {
  constructor(que: string) {
    super(404, 'NOT_FOUND', `${que} no existe.`);
  }
}

export class Conflicto extends ApiError {
  constructor(message: string, fields?: string[]) {
    super(409, 'CONFLICT', message, fields);
  }
}

export class Validacion extends ApiError {
  constructor(message: string, fields?: string[]) {
    super(400, 'VALIDATION_ERROR', message, fields);
  }
}

export class Prohibido extends ApiError {
  constructor(message: string) {
    super(403, 'FORBIDDEN', message);
  }
}
