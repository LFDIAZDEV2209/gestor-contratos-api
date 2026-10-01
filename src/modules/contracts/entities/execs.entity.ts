import {
  Column, CreateDateColumn, Entity, Index, PrimaryColumn, Unique, UpdateDateColumn,
} from 'typeorm';
import { Dinero, Porcentaje } from '../../../common/transforms';

/** Ejecución mensual (files/02 · prefijo EX). Un registro por periodo (contrato, periodo). */
@Entity('execs')
@Index('ix_execs_contract', ['contractId'])
@Unique('uk_execs_contract_periodo', ['contractId', 'periodo'])
export class ExecEntity {
  @PrimaryColumn('text')
  id!: string;

  @Column({ type: 'text' })
  contractId!: string;

  /** Periodo AAAA-MM. */
  @Column({ type: 'text' })
  periodo!: string;

  @Column({ type: 'bigint', transformer: Dinero })
  valor!: number;

  @Column({ type: 'numeric', precision: 5, scale: 2, transformer: Porcentaje })
  avanceFisico!: number;

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
