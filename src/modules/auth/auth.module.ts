import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtAuthGuard } from './jwt-auth.guard';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    UsersModule,
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: process.env.JWT_SECRET ?? 'cambia-este-secreto',
        // StringValue de 'ms' en el tipado de @nestjs/jwt; el valor es una cadena de duración.
        signOptions: { expiresIn: (process.env.JWT_EXPIRES ?? '12h') as never },
      }),
    }),
  ],
  providers: [AuthService, { provide: APP_GUARD, useClass: JwtAuthGuard }],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
