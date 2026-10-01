import {
  Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn,
} from 'typeorm';

/** Riesgos (files/02 · prefijo RG). prob e impacto de 1 a 5. */
@Entity('risks')
@Index('ix_risks_contract', ['contractId'])
@Index('ix_risks_estado', ['estado'])
export class RiskEntity {
  @PrimaryColumn('text')
  id!: string;

  @Column({ type: 'text' })
  contractId!: string;

  @Column({ type: 'text', nullable: true })
  categoria?: string | null;

  @Column({ type: 'text' })
  riesgo!: string;

  @Column({ type: 'int' })
  prob!: number;

  @Column({ type: 'int' })
  impacto!: number;

  @Column({ type: 'text', nullable: true })
  responsable?: string | null;

  @Column({ type: 'text', nullable: true })
  tratamiento?: string | null;

  @Column({ type: 'date', nullable: true })
  fecha?: string | null;

  @Column({ type: 'text', default: 'Abierto' })
  estado!: string;

  @Column({ type: 'text', nullable: true })
  mitigacion?: string | null;

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
