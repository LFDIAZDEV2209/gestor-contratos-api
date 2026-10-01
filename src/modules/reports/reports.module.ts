import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContractEntity } from '../contracts/entities/contract.entity';
import { PaymentEntity } from '../contracts/entities/payments.entity';
import { GuaranteeEntity } from '../contracts/entities/guarantees.entity';
import { CupoEntity } from '../contracts/entities/quotas.entity';
import { SubcontractEntity } from '../contracts/entities/subcontracts.entity';
import { ObligationEntity } from '../contracts/entities/obligations.entity';
import { DeliverableEntity } from '../contracts/entities/deliverables.entity';
import { ActaEntity } from '../contracts/entities/actas.entity';
import { ModificationEntity } from '../contracts/entities/modifications.entity';
import { RiskEntity } from '../contracts/entities/risks.entity';
import { BreachEntity } from '../contracts/entities/breaches.entity';
import { PlanEntity } from '../contracts/entities/plans.entity';
import { CompanyEntity } from '../companies/companies.entity';
import { AuditLogEntity } from '../audit/audit.entity';
import { ContractsCoreModule } from '../contracts/contracts.module';
import { InsuranceModule } from '../insurance/insurance.module';
import { GeoModule } from '../geo/geo.module';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ContractEntity, PaymentEntity, GuaranteeEntity, CupoEntity, SubcontractEntity,
      ObligationEntity, DeliverableEntity, ActaEntity, ModificationEntity, RiskEntity,
      BreachEntity, PlanEntity, CompanyEntity, AuditLogEntity,
    ]),
    ContractsCoreModule,
    InsuranceModule,
    GeoModule,
  ],
  providers: [ReportsService],
  controllers: [ReportsController],
})
export class ReportsModule {}
