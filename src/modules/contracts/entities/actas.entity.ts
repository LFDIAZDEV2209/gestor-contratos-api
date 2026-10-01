import {
  Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn,
} from 'typeorm';
import { Dinero } from '../../../common/transforms';

/** Actas (files/02 · prefijo AC). 8 tipos según catálogo tiposActa. */
@Entity('actas')
@Index('ix_actas_contract', ['contractId'])
@Index('ix_actas_tipo', ['tipo'])
@Index('ix_actas_estado', ['estado'])
@Index('ix_actas_fecha', ['fecha'])
export class ActaEntity {
  @PrimaryColumn('text')
  id!: string;

  @Column({ type: 'text' })
  contractId!: string;

  @Column({ type: 'text' })
  numero!: string;

  @Column({ type: 'text' })
  tipo!: string;

  @Column({ type: 'date', nullable: true })
  fecha?: string | null;

  @Column({ type: 'bigint', transformer: Dinero, nullable: true })
  valor?: number | null;

  @Column({ type: 'text' })
  descripcion!: string;

  @Column({ type: 'text', nullable: true })
  archivo?: string | null;

  @Column({ type: 'text', nullable: true })
  responsable?: string | null;

  @Column({ type: 'text', default: 'Borrador acta' })
  estado!: string;

  @Column({ type: 'text', nullable: true })
  motivoAnulacion?: string | null;

  @Column({ type: 'int', default: 1 })
  version!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
