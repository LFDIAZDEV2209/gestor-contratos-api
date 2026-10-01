import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolePermissionEntity } from './roles.entity';
import { PermissionsGuard } from './permissions.guard';
import { RolesService } from './roles.service';
import { RolesController } from './roles.controller';

/** Módulo global: la matriz de permisos se consulta desde todos los módulos. */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([RolePermissionEntity])],
  providers: [RolesService, { provide: APP_GUARD, useClass: PermissionsGuard }],
  controllers: [RolesController],
  exports: [RolesService],
})
export class RolesModule {}
