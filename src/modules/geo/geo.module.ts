import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContractEntity } from '../contracts/entities/contract.entity';
import { GuaranteeEntity } from '../contracts/entities/guarantees.entity';
import { CupoEntity } from '../contracts/entities/quotas.entity';
import { ContractsCoreModule } from '../contracts/contracts.module';
import { GeoService } from './geo.service';
import { GeoController } from './geo.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([ContractEntity, GuaranteeEntity, CupoEntity]),
    ContractsCoreModule,
  ],
  providers: [GeoService],
  controllers: [GeoController],
  exports: [GeoService],
})
export class GeoModule {}
