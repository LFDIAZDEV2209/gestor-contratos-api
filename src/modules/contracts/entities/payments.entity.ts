import {
  Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn,
} from 'typeorm';
import { Dinero } from '../../../common/transforms';

/** Pagos (files/02 · prefijo PG). neto = bruto + iva − retenciones (calculado en el servidor). */
@Entity('payments')
@Index('ix_payments_contract', ['contractId'])
@Index('ix_payments_estado', ['estado'])
@Index('ix_payments_fecha', ['fecha'])
export class PaymentEntity {
  @PrimaryColumn('text')
  id!: string;

  @Column({ type: 'text' })
  contractId!: string;

  @Column({ type: 'text' })
  numero!: string;

  @Column({ type: 'date', nullable: true })
  fecha?: string | null;

  @Column({ type: 'text' })
  factura!: string;

  @Column({ type: 'text', nullable: true })
  periodo?: string | null;

  @Column({ type: 'bigint', transformer: Dinero })
  bruto!: number;

  @Column({ type: 'bigint', transformer: Dinero, default: 0 })
  iva!: number;

  @Column({ type: 'bigint', transformer: Dinero, default: 0 })
  retenciones!: number;

  @Column({ type: 'bigint', transformer: Dinero })
  neto!: number;

  @Column({ type: 'text', default: 'Pendiente' })
  estado!: string;

  @Column({ type: 'date', nullable: true })
  fechaAprob?: string | null;

  @Column({ type: 'date', nullable: true })
  fechaPago?: string | null;

  @Column({ type: 'text', nullable: true })
  soporte?: string | null;

  @Column({ type: 'text', nullable: true })
  motivoAnulacion?: string | null;

  @Column({ type: 'int', default: 1 })
  version!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
