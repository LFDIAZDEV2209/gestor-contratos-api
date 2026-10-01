import {
  Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn,
} from 'typeorm';
import { Dinero, Porcentaje } from '../../../common/transforms';

/** Contratos (files/02 · prefijo CT). Sin borrado físico: anulado=true + estado Anulado. */
@Entity('contracts')
@Index('ix_contracts_company', ['companyId'])
@Index('ix_contracts_estado', ['estado'])
@Index('ix_contracts_fecha_fin', ['fechaFin'])
@Index('ix_contracts_anulado', ['anulado'])
export class ContractEntity {
  @PrimaryColumn('text')
  id!: string;

  /** Número único del contrato (duplicado ⇒ 409 CONFLICT). */
  @Column({ type: 'text', unique: true })
  numero!: string;

  @Column({ type: 'text' })
  tipo!: string;

  @Column({ type: 'text', nullable: true })
  modalidad?: string | null;

  @Column({ type: 'text' })
  companyId!: string;

  @Column({ type: 'text', default: 'Borrador' })
  estado!: string;

  @Column({ type: 'text' })
  contratista!: string;

  @Column({ type: 'text' })
  nitContratista!: string;

  @Column({ type: 'text', nullable: true })
  repContratista?: string | null;

  @Column({ type: 'text', nullable: true })
  area?: string | null;

  @Column({ type: 'text' })
  objeto!: string;

  @Column({ type: 'text', nullable: true })
  descripcion?: string | null;

  @Column({ type: 'text' })
  responsable!: string;

  @Column({ type: 'text' })
  supervisor!: string;

  @Column({ type: 'text', nullable: true })
  interventor?: string | null;

  /** Códigos DANE de ejecución (cobertura); el primero es la sede principal. */
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  deptos!: string[];

  @Column({ type: 'text', nullable: true })
  municipio?: string | null;

  @Column({ type: 'date', nullable: true })
  fechaFirma?: string | null;

  @Column({ type: 'date', nullable: true })
  fechaInicio?: string | null;

  @Column({ type: 'date', nullable: true })
  fechaFin?: string | null;

  @Column({ type: 'boolean', default: false })
  hastaAgotar!: boolean;

  @Column({ type: 'bigint', transformer: Dinero })
  valorBase!: number;

  @Column({ type: 'bigint', transformer: Dinero, default: 0 })
  iva!: number;

  @Column({ type: 'bigint', transformer: Dinero, default: 0 })
  otrosImp!: number;

  @Column({ type: 'bigint', transformer: Dinero, default: 0 })
  adiciones!: number;

  @Column({ type: 'bigint', transformer: Dinero, default: 0 })
  reducciones!: number;

  @Column({ type: 'numeric', precision: 5, scale: 2, transformer: Porcentaje, nullable: true })
  avanceFisico?: number | null;

  @Column({ type: 'text', nullable: true })
  alcance?: string | null;

  @Column({ type: 'text', nullable: true })
  productos?: string | null;

  @Column({ type: 'text', nullable: true })
  indicadores?: string | null;

  @Column({ type: 'boolean', default: false })
  anulado!: boolean;

  @Column({ type: 'text', nullable: true })
  motivoAnulacion?: string | null;

  @Column({ type: 'int', default: 1 })
  version!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
