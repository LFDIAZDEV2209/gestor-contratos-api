import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogEntity } from './audit.entity';
import { AuditService } from './audit.service';

/** Módulo global: todos los servicios de dominio registran auditoría. */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([AuditLogEntity])],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
