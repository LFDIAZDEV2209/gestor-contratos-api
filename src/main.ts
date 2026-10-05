import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import { AppModule } from './app.module';
import { ApiError } from './common/exceptions/api-exception';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { CorrelationIdMiddleware } from './common/observability/correlation-id.middleware';
import { HttpLoggingInterceptor } from './common/observability/http-logging.interceptor';
import { nestLogger } from './common/observability/logger';
import { configureTypeOrmObservability } from './common/observability/typeorm-logger';
import 'reflect-metadata';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: false, logger: nestLogger });

  app.setGlobalPrefix('api');
  app.enableShutdownHooks();
  const correlationIdMiddleware = new CorrelationIdMiddleware();
  app.use(correlationIdMiddleware.use.bind(correlationIdMiddleware));
  app.useGlobalInterceptors(new HttpLoggingInterceptor());
  configureTypeOrmObservability(app.get(DataSource));
  app.enableCors({
    origin: (process.env.CORS_ORIGIN ?? 'http://localhost:3000').split(',').map((s) => s.trim()),
    credentials: true,
    exposedHeaders: ['x-request-id'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      exceptionFactory: (errores) => {
        const campos = errores.map((e) => Object.values(e.constraints ?? {})).flat();
        return new ApiError(400, 'VALIDATION_ERROR', `Datos inválidos: ${errores.length} campo(s) con problemas.`, campos);
      },
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  const doc = new DocumentBuilder()
    .setTitle('Nexo · Gestor Integral de Contratos — API')
    .setDescription(
      'API REST del backend de contratos (files/03). Autenticación: Bearer JWT de /auth/login. ' +
      'Sin borrado físico: anulación con POST /…/:id/void + motivo. Concurrencia: campo version (409). ' +
      'Advertencias aceptables: 422 con ?force=true.',
    )
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api-docs', app, SwaggerModule.createDocument(app, doc));

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);
  new Logger('Bootstrap').log(`API escuchando en http://localhost:${port}/api · Swagger en /api-docs`);
}

bootstrap().catch((e) => {
  new Logger('Bootstrap').error(`Fallo al iniciar: ${e instanceof Error ? e.stack : e}`);
  process.exit(1);
});
