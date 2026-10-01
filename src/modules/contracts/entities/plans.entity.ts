import {
  Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn,
} from 'typeorm';
import { Porcentaje } from '../../../common/transforms';

/** Planes de mejoramiento (files/02 · prefijo PM). */
@Entity('plans')
@Index('ix_plans_contract', ['contractId'])
@Index('ix_plans_estado', ['estado'])
export class PlanEntity {
  @PrimaryColumn('text')
  id!: string;

  @Column({ type: 'text' })
  contractId!: string;

  @Column({ type: 'date', nullable: true })
  fecha?: string | null;

  @Column({ type: 'text' })
  hallazgo!: string;

  @Column({ type: 'text', nullable: true })
  causa?: string | null;

  @Column({ type: 'text' })
  accion!: string;

  @Column({ type: 'text', nullable: true })
  responsable?: string | null;

  @Column({ type: 'text', default: 'Abierto' })
  estado!: string;

  @Column({ type: 'numeric', precision: 5, scale: 2, transformer: Porcentaje, nullable: true })
  avance?: number | null;

  @Column({ type: 'text', nullable: true })
  evidencia?: string | null;

  @Column({ type: 'text', nullable: true })
  motivoAnulacion?: string | null;

  @Column({ type: 'int', default: 1 })
  version!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
