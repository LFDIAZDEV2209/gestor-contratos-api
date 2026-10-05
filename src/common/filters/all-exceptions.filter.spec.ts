import { AllExceptionsFilter } from './all-exceptions.filter';
import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { OptimisticLockVersionMismatchError, QueryFailedError } from 'typeorm';
import {
  ApiError,
  WarningRequiresConfirmation,
  Validacion,
  Conflicto,
  NoEncontrado,
} from '../exceptions/api-exception';

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;
  let mockHost: ArgumentsHost;

  beforeEach(() => {
    filter = new AllExceptionsFilter();
    mockJson = jest.fn();
    mockStatus = jest.fn().mockReturnValue({ json: mockJson });

    mockHost = {
      switchToHttp: () => ({
        getResponse: () => ({
          status: mockStatus,
        }),
        getRequest: () => ({}),
        getNext: () => ({}),
      }),
    } as unknown as ArgumentsHost;
  });

  it('formatea excepciones ApiError estándar', () => {
    const error = new Validacion('Campo requerido', ['numero']);
    filter.catch(error, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(400);
    expect(mockJson).toHaveBeenCalledWith({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Campo requerido',
        fields: ['numero'],
      },
    });
  });

  it('incluye warnings en WarningRequiresConfirmation (422)', () => {
    const error = new WarningRequiresConfirmation('Inconsistencias', ['Advertencia 1', 'Advertencia 2']);
    filter.catch(error, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(422);
    expect(mockJson).toHaveBeenCalledWith({
      error: {
        code: 'WARNING_REQUIRES_CONFIRMATION',
        message: 'Inconsistencias',
        warnings: ['Advertencia 1', 'Advertencia 2'],
      },
    });
  });

  it('transforma OptimisticLockVersionMismatchError en 409 CONFLICT', () => {
    const error = new OptimisticLockVersionMismatchError('Entity', 1, 2);
    filter.catch(error, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(409);
    expect(mockJson).toHaveBeenCalledWith({
      error: {
        code: 'CONFLICT',
        message: 'La versión del registro está desactualizada. Recargue el registro y vuelva a intentarlo.',
      },
    });
  });

  it('transforma QueryFailedError de clave duplicada (23505) en 409 CONFLICT', () => {
    const driverError = { code: '23505' };
    const error = new QueryFailedError('SELECT 1', [], driverError as any);
    (error as any).driverError = driverError;

    filter.catch(error, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(409);
    expect(mockJson).toHaveBeenCalledWith({
      error: {
        code: 'CONFLICT',
        message: 'Registro duplicado: ya existe un registro con el mismo valor único.',
      },
    });
  });

  it('transforma QueryFailedError de clave foránea (23503) en 400 VALIDATION_ERROR', () => {
    const driverError = { code: '23503' };
    const error = new QueryFailedError('INSERT INTO ...', [], driverError as any);
    (error as any).driverError = driverError;

    filter.catch(error, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(400);
    expect(mockJson).toHaveBeenCalledWith({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Referencia inválida: el registro relacionado no existe.',
      },
    });
  });

  it('transforma HttpException genérica con array de mensajes', () => {
    const httpEx = new HttpException(
      { code: 'VALIDATION_ERROR', message: ['nombre debe ser texto', 'edad debe ser número'] },
      HttpStatus.BAD_REQUEST,
    );
    filter.catch(httpEx, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(400);
    expect(mockJson).toHaveBeenCalledWith({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'nombre debe ser texto; edad debe ser número',
        fields: ['nombre debe ser texto', 'edad debe ser número'],
      },
    });
  });

  it('captura Error desconocido devolviendo 500 INTERNAL_ERROR', () => {
    const errorInesperado = new Error('Fallo de conexión a la base de datos');
    filter.catch(errorInesperado, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(500);
    expect(mockJson).toHaveBeenCalledWith({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Fallo de conexión a la base de datos',
      },
    });
  });
});
