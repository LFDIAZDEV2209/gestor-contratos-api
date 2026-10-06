import { INestApplication, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import request = require('supertest');
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RolesService } from '../roles/roles.service';

const respuesta = {
  token: 'token-demo',
  usuario: { id: 'U1', email: 'lmendez@empresa.co', nombre: 'Laura Méndez', rol: 'ADMINISTRADOR' },
  permisos: ['VER'],
};

@Module({
  controllers: [AuthController],
  providers: [
    { provide: AuthService, useValue: { login: jest.fn().mockResolvedValue(respuesta) } },
    { provide: RolesService, useValue: {} },
  ],
})
class ModuloPruebaAuth {}

describe('AuthController: contrato HTTP del login', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await NestFactory.create(ModuloPruebaAuth, { logger: false });
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('responde 200 y conserva token, usuario y permisos', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'lmendez@empresa.co' })
      .expect(200)
      .expect(respuesta);
  });
});
