import { CompanyEntity } from '../modules/companies/companies.entity';
import { ContractEntity } from '../modules/contracts/entities/contract.entity';
import { SubcontractEntity } from '../modules/contracts/entities/subcontracts.entity';
import {
  ObligationEntity, ObligationChecklistEntity, ObligationCommentEntity, ObligationEvidenceEntity,
} from '../modules/contracts/entities/obligations.entity';
import { DeliverableEntity } from '../modules/contracts/entities/deliverables.entity';
import { ExecEntity } from '../modules/contracts/entities/execs.entity';
import { PaymentEntity } from '../modules/contracts/entities/payments.entity';
import { GuaranteeEntity } from '../modules/contracts/entities/guarantees.entity';
import { CupoEntity } from '../modules/contracts/entities/quotas.entity';
import { ActaEntity } from '../modules/contracts/entities/actas.entity';
import { ModificationEntity } from '../modules/contracts/entities/modifications.entity';
import { RiskEntity } from '../modules/contracts/entities/risks.entity';
import { BreachEntity } from '../modules/contracts/entities/breaches.entity';
import { PlanEntity } from '../modules/contracts/entities/plans.entity';
import { DocumentEntity, DocumentVersionEntity } from '../modules/contracts/entities/documents.entity';
import { UserEntity } from '../modules/users/users.entity';
import { RolePermissionEntity } from '../modules/roles/roles.entity';
import { SettingEntity, CatalogEntity, CatalogItemEntity } from '../modules/settings/settings.entity';
import { AlertStateEntity, AlertKeyEntity, TaskEntity } from '../modules/alerts/alerts.entity';
import { AuditLogEntity } from '../modules/audit/audit.entity';

/** Registro único de entidades para TypeORM (data-source y Nest). */
export const ENTIDADES = [
  CompanyEntity,
  ContractEntity,
  SubcontractEntity,
  ObligationEntity,
  ObligationChecklistEntity,
  ObligationCommentEntity,
  ObligationEvidenceEntity,
  DeliverableEntity,
  ExecEntity,
  PaymentEntity,
  GuaranteeEntity,
  CupoEntity,
  ActaEntity,
  ModificationEntity,
  RiskEntity,
  BreachEntity,
  PlanEntity,
  DocumentEntity,
  DocumentVersionEntity,
  UserEntity,
  RolePermissionEntity,
  SettingEntity,
  CatalogEntity,
  CatalogItemEntity,
  AlertStateEntity,
  AlertKeyEntity,
  TaskEntity,
  AuditLogEntity,
];
