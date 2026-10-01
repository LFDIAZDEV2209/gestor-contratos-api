import {
  Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn,
} from 'typeorm';
import { Dinero } from '../../../common/transforms';

/**
 * Modificaciones (files/02 · prefijo MD). Inmutables: no se editan, se anulan y
 * se registra una nueva. Al crearlas, el servidor aplica su efecto sobre el
 * contrato dentro de la misma transacción.
 */
@Entity('modifications')
@Index('ix_modifications_contract', ['contractId'])
@Index('ix_modifications_estado', ['estado'])
export class ModificationEntity {
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

  @Column({ type: 'text', nullable: true })
  soporte?: string | null;

  @Column({ type: 'text' })
  justificacion!: string;

  @Column({ type: 'bigint', transformer: Dinero, nullable: true })
  valorAnterior?: number | null;

  @Column({ type: 'bigint', transformer: Dinero, nullable: true })
  valorNuevo?: number | null;

  /** Nuevo supervisor / cesionario. */
  @Column({ type: 'text', nullable: true })
  nuevoTexto?: string | null;

  @Column({ type: 'date', nullable: true })
  fechaAnterior?: string | null;

  @Column({ type: 'date', nullable: true })
  fechaNueva?: string | null;

  @Column({ type: 'text', nullable: true })
  impacto?: string | null;

  @Column({ type: 'text', default: 'Activa' })
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
