import {
  Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn,
} from 'typeorm';
import { Porcentaje } from '../../../common/transforms';

/** Obligaciones (files/02 · prefijo OB). */
@Entity('obligations')
@Index('ix_obligations_contract', ['contractId'])
@Index('ix_obligations_estado', ['estado'])
@Index('ix_obligations_fecha_limite', ['fechaLimite'])
export class ObligationEntity {
  @PrimaryColumn('text')
  id!: string;

  @Column({ type: 'text' })
  contractId!: string;

  @Column({ type: 'text', nullable: true })
  tipo?: string | null;

  @Column({ type: 'text' })
  descripcion!: string;

  @Column({ type: 'text' })
  responsable!: string;

  @Column({ type: 'date', nullable: true })
  fechaLimite?: string | null;

  @Column({ type: 'text', nullable: true })
  periodicidad?: string | null;

  @Column({ type: 'text', nullable: true })
  evidencia?: string | null;

  @Column({ type: 'text', default: 'Pendiente' })
  estado!: string;

  @Column({ type: 'numeric', precision: 5, scale: 2, transformer: Porcentaje, nullable: true })
  cumplimiento?: number | null;

  @Column({ type: 'text', nullable: true })
  obs?: string | null;

  @Column({ type: 'text', nullable: true })
  motivoAnulacion?: string | null;

  @Column({ type: 'int', default: 1 })
  version!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}

/** Ítems del checklist de una obligación. */
@Entity('obligation_checklist')
@Index('ix_obchecklist_obligation', ['obligationId'])
export class ObligationChecklistEntity {
  @PrimaryColumn('text')
  id!: string;

  @Column({ type: 'text' })
  obligationId!: string;

  @Column({ type: 'text' })
  texto!: string;

  @Column({ type: 'boolean', default: false })
  hecho!: boolean;

  @Column({ type: 'int', default: 0 })
  orden!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}

/** Comentarios de una obligación. */
@Entity('obligation_comments')
@Index('ix_obcomments_obligation', ['obligationId'])
export class ObligationCommentEntity {
  @PrimaryColumn('text')
  id!: string;

  @Column({ type: 'text' })
  obligationId!: string;

  @Column({ type: 'text' })
  usuario!: string;

  @Column({ type: 'text' })
  texto!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}

/** Evidencias cargadas de una obligación (archivo en disco; blob storage en fase 2). */
@Entity('obligation_evidences')
@Index('ix_obevidences_obligation', ['obligationId'])
export class ObligationEvidenceEntity {
  @PrimaryColumn('text')
  id!: string;

  @Column({ type: 'text' })
  obligationId!: string;

  @Column({ type: 'text' })
  nombre!: string;

  @Column({ type: 'text' })
  archivo!: string;

  @Column({ type: 'text' })
  usuario!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
