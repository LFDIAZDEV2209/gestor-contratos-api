import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContractEntity } from './entities/contract.entity';
import { SubcontractEntity } from './entities/subcontracts.entity';
import { ObligationEntity, ObligationChecklistEntity, ObligationCommentEntity, ObligationEvidenceEntity } from './entities/obligations.entity';
import { DeliverableEntity } from './entities/deliverables.entity';
import { ExecEntity } from './entities/execs.entity';
import { PaymentEntity } from './entities/payments.entity';
import { GuaranteeEntity } from './entities/guarantees.entity';
import { CupoEntity } from './entities/quotas.entity';
import { ActaEntity } from './entities/actas.entity';
import { ModificationEntity } from './entities/modifications.entity';
import { RiskEntity } from './entities/risks.entity';
import { BreachEntity } from './entities/breaches.entity';
import { PlanEntity } from './entities/plans.entity';
import { DocumentEntity, DocumentVersionEntity } from './entities/documents.entity';
import { AuditLogEntity } from '../audit/audit.entity';
import { ContractContextLoader } from './contract-context.loader';
import { ContractsService } from './contracts.service';
import { ContractsController } from './contracts.controller';
import { ObligacionesService } from './obligaciones.service';
import { ObligacionesExtrasController } from './obligaciones-extras.controller';
import { PagosService } from './pagos.service';
import { PagosExtrasController } from './pagos-extras.controller';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';

/**
 * Núcleo del dominio de contratos (sin el CRUD genérico de colecciones:
 * ese vive en ChildCollectionsModule, que debe registrarse al FINAL
 * del enrutador para no tragarse rutas de otros módulos).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      ContractEntity, SubcontractEntity, ObligationEntity, ObligationChecklistEntity,
      ObligationCommentEntity, ObligationEvidenceEntity, DeliverableEntity, ExecEntity,
      PaymentEntity, GuaranteeEntity, CupoEntity, ActaEntity, ModificationEntity,
      RiskEntity, BreachEntity, PlanEntity, DocumentEntity, DocumentVersionEntity, AuditLogEntity,
    ]),
  ],
  providers: [
    ContractContextLoader, ContractsService,
    ObligacionesService, DocumentsService, PagosService,
  ],
  controllers: [
    ContractsController,
    ObligacionesExtrasController,
    DocumentsController,
    PagosExtrasController,
  ],
  exports: [ContractsService, ContractContextLoader],
})
export class ContractsCoreModule {}
