import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogEntity } from './audit.entity';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';

@Module({
  imports: [TypeOrmModule.forFeature([AuditLogEntity])],
  providers: [AuditService, AuditController],
  controllers: [AuditController],
  exports: [AuditService],
})
export class AuditReadOnlyModule {}
