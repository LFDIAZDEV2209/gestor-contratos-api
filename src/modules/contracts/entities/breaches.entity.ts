import {
  Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn,
} from 'typeorm';
import { Dinero } from '../../../common/transforms';

/** Incumplimientos (files/02 · prefijo IN). Impacto: Bajo / Medio / Alto. */
@Entity('breaches')
@Index('ix_breaches_contract', ['contractId'])
@Index('ix_breaches_obligation', ['obligationId'])
@Index('ix_breaches_estado', ['estado'])
export class BreachEntity {
  @PrimaryColumn('text')
  id!: string;

  @Column({ type: 'text' })
  contractId!: string;

  @Column({ type: 'date', nullable: true })
  fecha?: string | null;

  @Column({ type: 'text', nullable: true })
  obligationId?: string | null;

  @Column({ type: 'text' })
  tipo!: string;

  @Column({ type: 'text' })
  descripcion!: string;

  @Column({ type: 'text', nullable: true })
  responsable?: string | null;

  @Column({ type: 'text', nullable: true })
  impacto?: string | null;

  @Column({ type: 'text', default: 'Abierto' })
  estado!: string;

  @Column({ type: 'text', nullable: true })
  plan?: string | null;

  @Column({ type: 'date', nullable: true })
  fechaLimite?: string | null;

  @Column({ type: 'text', nullable: true })
  medida?: string | null;

  @Column({ type: 'bigint', transformer: Dinero, nullable: true })
  multa?: number | null;

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
