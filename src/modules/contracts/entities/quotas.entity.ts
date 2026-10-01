import {
  Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn,
} from 'typeorm';
import { Dinero } from '../../../common/transforms';

/** Cupos de aseguradoras (files/02 · prefijo CP). */
@Entity('cupos')
@Index('ix_cupos_aseguradora', ['aseguradora'])
@Index('ix_cupos_estado', ['estado'])
@Index('ix_cupos_fecha_venc', ['fechaVenc'])
export class CupoEntity {
  @PrimaryColumn('text')
  id!: string;

  @Column({ type: 'text' })
  aseguradora!: string;

  @Column({ type: 'text' })
  numero!: string;

  @Column({ type: 'text' })
  tomador!: string;

  @Column({ type: 'text', nullable: true })
  intermediario?: string | null;

  @Column({ type: 'bigint', transformer: Dinero })
  valor!: number;

  @Column({ type: 'date', nullable: true })
  fechaInicio?: string | null;

  @Column({ type: 'date', nullable: true })
  fechaVenc?: string | null;

  @Column({ type: 'text', default: 'Vigente' })
  estado!: string;

  @Column({ type: 'text', nullable: true })
  observaciones?: string | null;

  @Column({ type: 'text', nullable: true })
  motivoAnulacion?: string | null;

  @Column({ type: 'int', default: 1 })
  version!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
