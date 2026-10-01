import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SettingEntity, CatalogEntity, CatalogItemEntity } from './settings.entity';
import { SettingsService } from './settings.service';
import { SettingsController } from './settings.controller';

/** Módulo global: los parámetros de alertas alimentan los motores de negocio. */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([SettingEntity, CatalogEntity, CatalogItemEntity])],
  providers: [SettingsService],
  controllers: [SettingsController],
  exports: [SettingsService],
})
export class SettingsModule {}
