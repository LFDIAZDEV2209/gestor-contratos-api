import {
  Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn,
} from 'typeorm';
import { Dinero, Porcentaje } from '../../../common/transforms';

/** Seguros y garantías / pólizas (files/02 · prefijo GR). Una póliza anulada libera su cupo. */
@Entity('guarantees')
@Index('ix_guarantees_contract', ['contractId'])
@Index('ix_guarantees_aseguradora', ['aseguradora'])
@Index('ix_guarantees_estado', ['estado'])
@Index('ix_guarantees_cupo', ['cupoId'])
@Index('ix_guarantees_fecha_venc', ['fechaVenc'])
export class GuaranteeEntity {
  @PrimaryColumn('text')
  id!: string;

  @Column({ type: 'text' })
  contractId!: string;

  @Column({ type: 'text' })
  tipo!: string;

  @Column({ type: 'text' })
  aseguradora!: string;

  @Column({ type: 'text' })
  poliza!: string;

  @Column({ type: 'text', default: 'Póliza individual' })
  modalidadPoliza!: string;

  @Column({ type: 'text', nullable: true })
  cupoId?: string | null;

  @Column({ type: 'numeric', precision: 5, scale: 2, transformer: Porcentaje, nullable: true })
  porcentaje?: number | null;

  @Column({ type: 'text', nullable: true })
  tomador?: string | null;

  @Column({ type: 'text', nullable: true })
  intermediario?: string | null;

  @Column({ type: 'bigint', transformer: Dinero, nullable: true })
  prima?: number | null;

  @Column({ type: 'bigint', transformer: Dinero })
  valor!: number;

  @Column({ type: 'date', nullable: true })
  fechaExp?: string | null;

  @Column({ type: 'date', nullable: true })
  fechaInicio?: string | null;

  @Column({ type: 'date', nullable: true })
  fechaVenc?: string | null;

  @Column({ type: 'text', default: 'Pendiente' })
  estado!: string;

  @Column({ type: 'text', nullable: true })
  documento?: string | null;

  @Column({ type: 'text', nullable: true })
  relacion?: string | null;

  @Column({ type: 'text', nullable: true })
  motivoAnulacion?: string | null;

  @Column({ type: 'int', default: 1 })
  version!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
