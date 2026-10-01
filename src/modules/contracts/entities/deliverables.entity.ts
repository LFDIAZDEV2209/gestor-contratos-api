import {
  Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn,
} from 'typeorm';
import { Porcentaje } from '../../../common/transforms';

/** Entregables (files/02 · prefijo EN). */
@Entity('deliverables')
@Index('ix_deliverables_contract', ['contractId'])
@Index('ix_deliverables_estado', ['estado'])
export class DeliverableEntity {
  @PrimaryColumn('text')
  id!: string;

  @Column({ type: 'text' })
  contractId!: string;

  @Column({ type: 'text' })
  nombre!: string;

  @Column({ type: 'text', nullable: true })
  descripcion?: string | null;

  @Column({ type: 'date', nullable: true })
  fechaInicio?: string | null;

  @Column({ type: 'date', nullable: true })
  fechaProg?: string | null;

  @Column({ type: 'date', nullable: true })
  fechaReal?: string | null;

  @Column({ type: 'text', nullable: true })
  responsable?: string | null;

  @Column({ type: 'text', default: 'Pendiente' })
  estado!: string;

  @Column({ type: 'numeric', precision: 5, scale: 2, transformer: Porcentaje, nullable: true })
  avance?: number | null;

  @Column({ type: 'text', nullable: true })
  evidencia?: string | null;

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
