import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContractEntity } from '../contracts/entities/contract.entity';
import { CupoEntity } from '../contracts/entities/quotas.entity';
import { GuaranteeEntity } from '../contracts/entities/guarantees.entity';
import { AlertStateEntity, AlertKeyEntity, TaskEntity } from './alerts.entity';
import { ContractsCoreModule } from '../contracts/contracts.module';
import { UsersModule } from '../users/users.module';import { AlertsService } from './alerts.service';
import { AlertsController } from './alerts.controller';
import { AlertsWorker } from './alerts.worker';

/** Alertas calculadas en servidor + tareas + worker diario (@nestjs/schedule). */
@Module({
  imports: [
    TypeOrmModule.forFeature([ContractEntity, CupoEntity, GuaranteeEntity, AlertStateEntity, AlertKeyEntity, TaskEntity]),
    ContractsCoreModule,
    UsersModule,
  ],
  providers: [AlertsService, AlertsWorker],
  controllers: [AlertsController],
  exports: [AlertsService],
})
export class AlertsModule {}
