import {
  Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn,
} from 'typeorm';
import { Dinero, Porcentaje } from '../../../common/transforms';

/** Subcontratos (files/02 · prefijo SC). La suma no puede superar el valor del contrato principal. */
@Entity('subcontracts')
@Index('ix_subcontracts_contract', ['contractId'])
@Index('ix_subcontracts_estado', ['estado'])
export class SubcontractEntity {
  @PrimaryColumn('text')
  id!: string;

  @Column({ type: 'text' })
  contractId!: string;

  @Column({ type: 'text' })
  numero!: string;

  @Column({ type: 'text' })
  contratista!: string;

  @Column({ type: 'text' })
  nit!: string;

  @Column({ type: 'text' })
  objeto!: string;

  @Column({ type: 'bigint', transformer: Dinero })
  valor!: number;

  @Column({ type: 'date', nullable: true })
  fechaInicio?: string | null;

  @Column({ type: 'date', nullable: true })
  fechaFin?: string | null;

  @Column({ type: 'text', default: 'Activo' })
  estado!: string;

  @Column({ type: 'numeric', precision: 5, scale: 2, transformer: Porcentaje, nullable: true })
  ejecucion?: number | null;

  @Column({ type: 'text', nullable: true })
  responsable?: string | null;

  @Column({ type: 'text', nullable: true })
  documentos?: string | null;

  @Column({ type: 'text', nullable: true })
  riesgos?: string | null;

  @Column({ type: 'text', nullable: true })
  obligaciones?: string | null;

  @Column({ type: 'text', nullable: true })
  motivoAnulacion?: string | null;

  @Column({ type: 'int', default: 1 })
  version!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
