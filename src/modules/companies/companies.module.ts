import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompanyEntity } from './companies.entity';
import { ContractEntity } from '../contracts/entities/contract.entity';
import { ExecEntity } from '../contracts/entities/execs.entity';
import { CompaniesService } from './companies.service';
import { CompaniesController } from './companies.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CompanyEntity, ContractEntity, ExecEntity])],
  providers: [CompaniesService],
  controllers: [CompaniesController],
  exports: [CompaniesService],
})
export class CompaniesModule {}
