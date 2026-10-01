import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GuaranteeEntity } from '../contracts/entities/guarantees.entity';
import { CupoEntity } from '../contracts/entities/quotas.entity';
import { ContractEntity } from '../contracts/entities/contract.entity';
import { ContractsCoreModule } from '../contracts/contracts.module';
import { InsuranceService } from './insurance.service';
import { InsuranceController } from './insurance.controller';

/** Pólizas, aseguradoras y cupos. */
@Module({
  imports: [
    TypeOrmModule.forFeature([GuaranteeEntity, CupoEntity, ContractEntity]),
    ContractsCoreModule,
  ],
  providers: [InsuranceService],
  controllers: [InsuranceController],
  exports: [InsuranceService],
})
export class InsuranceModule {}
