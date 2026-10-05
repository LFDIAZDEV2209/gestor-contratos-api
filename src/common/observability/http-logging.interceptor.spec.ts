import { ArgumentsHost, ExecutionContext } from '@nestjs/common';
import { EventEmitter } from 'events';
import { firstValueFrom, of, throwError } from 'rxjs';
import { AllExceptionsFilter } from '../filters/all-exceptions.filter';
import { HttpLoggingInterceptor } from './http-logging.interceptor';
import { logStructured } from './logger';

jest.mock('./logger', () => ({ logStructured: jest.fn() }));

function requestContext(req: Record<string, unknown>) {
  const responseEvents = new EventEmitter();
  const res = Object.assign(responseEvents, {
    statusCode: 200,
    status(code: number) { this.statusCode = code; return this; },
    json() { responseEvents.emit('finish'); },
  });
  const context = { switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }) } as unknown as ExecutionContext;
  return { res, context };
}

describe('HttpLoggingInterceptor', () => {
  beforeEach(() => jest.clearAllMocks());

  it('espera finish, usa reqUser y registra una sola vez sin querystring', async () => {
    const { res, context } = requestContext({
      requestId: 'request-1', method: 'GET', originalUrl: '/api/example?token=private-token',
      reqUser: { id: 'real-user', rol: 'ADMINISTRADOR' }, user: { id: 'fallback-user', role: 'fallback-role' },
    });
    await firstValueFrom(new HttpLoggingInterceptor().intercept(context, { handle: () => of({ ok: true }) }));
    expect(logStructured).not.toHaveBeenCalled();

    res.statusCode = 201;
    res.emit('finish');
    res.emit('finish');

    expect(logStructured).toHaveBeenCalledTimes(1);
    expect(logStructured).toHaveBeenCalledWith('info', 'http.request.completed', expect.objectContaining({
      requestId: 'request-1', userId: 'real-user', rol: 'ADMINISTRADOR', ruta: '/api/example', status: 201,
    }));
  });

  it('usa req.user como fallback y advierte si la respuesta supera 500ms', async () => {
    const timer = jest.spyOn(process.hrtime, 'bigint').mockReturnValueOnce(0n).mockReturnValueOnce(501_000_000n);
    try {
      const { res, context } = requestContext({ method: 'GET', url: '/api/example', user: { sub: 'legacy-user', role: 'legacy-role' } });
      await firstValueFrom(new HttpLoggingInterceptor().intercept(context, { handle: () => of(null) }));
      res.emit('finish');
      expect(logStructured).toHaveBeenCalledWith('warn', 'http.request.completed', expect.objectContaining({
        userId: 'legacy-user', rol: 'legacy-role', duracionMs: 501,
      }));
    } finally { timer.mockRestore(); }
  });

  it('propaga la excepción al filtro y registra su status final 500 en finish', async () => {
    const { context } = requestContext({ requestId: 'error-request', method: 'GET', url: '/api/example' });
    const error = new Error('Connection failed');
    await expect(firstValueFrom(new HttpLoggingInterceptor().intercept(context, { handle: () => throwError(() => error) }))).rejects.toBe(error);
    expect(logStructured).not.toHaveBeenCalled();

    new AllExceptionsFilter().catch(error, context as unknown as ArgumentsHost);

    const httpLogs = (logStructured as jest.Mock).mock.calls.filter(([, event]) => event === 'http.request.completed');
    expect(httpLogs).toHaveLength(1);
    expect(httpLogs[0][2]).toEqual(expect.objectContaining({ requestId: 'error-request', status: 500, error: 'Error' }));
  });
});
