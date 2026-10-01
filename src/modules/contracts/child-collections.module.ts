import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContractEntity } from './entities/contract.entity';
import { SubcontractEntity } from './entities/subcontracts.entity';
import { ObligationEntity } from './entities/obligations.entity';
import { DeliverableEntity } from './entities/deliverables.entity';
import { ExecEntity } from './entities/execs.entity';
import { PaymentEntity } from './entities/payments.entity';
import { ActaEntity } from './entities/actas.entity';
import { ModificationEntity } from './entities/modifications.entity';
import { RiskEntity } from './entities/risks.entity';
import { BreachEntity } from './entities/breaches.entity';
import { PlanEntity } from './entities/plans.entity';
import { ChildCollectionsService } from './child-collections.service';
import { ChildCollectionsController } from './child-collections.controller';

/**
 * CRUD genérico de las colecciones hijas (rutas con :collection). Se importa
 * AL FINAL en AppModule: sus rutas parametrizadas deben registrarse después
 * de las rutas específicas de todos los demás módulos.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      ContractEntity, SubcontractEntity, ObligationEntity, DeliverableEntity, ExecEntity,
      PaymentEntity, ActaEntity, ModificationEntity, RiskEntity, BreachEntity, PlanEntity,
    ]),
  ],
  providers: [ChildCollectionsService],
  controllers: [ChildCollectionsController],
})
export class ChildCollectionsModule {}
