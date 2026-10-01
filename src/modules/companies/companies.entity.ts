import {
  Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn,
} from 'typeorm';

/** Empresas contratantes (files/02 · prefijo EMP). Sin borrado físico: anular = estado Inactiva. */
@Entity('companies')
@Index('ix_companies_estado', ['estado'])
export class CompanyEntity {
  @PrimaryColumn('text')
  id!: string;

  @Column({ type: 'text' })
  razon!: string;

  /** NIT sin puntos ni guiones para comparar; se guarda tal cual y se normaliza al validar. */
  @Column({ type: 'text', unique: true })
  nit!: string;

  @Column({ type: 'text', nullable: true })
  tipo?: string | null;

  @Column({ type: 'text', nullable: true })
  direccion?: string | null;

  @Column({ type: 'text', nullable: true })
  ciudad?: string | null;

  @Column({ type: 'text', nullable: true })
  depto?: string | null;

  @Column({ type: 'text', nullable: true })
  pais?: string | null;

  @Column({ type: 'text', nullable: true })
  rep?: string | null;

  @Column({ type: 'text', nullable: true })
  repDoc?: string | null;

  @Column({ type: 'text', nullable: true })
  tel?: string | null;

  @Column({ type: 'text', nullable: true })
  email?: string | null;

  @Column({ type: 'text', nullable: true })
  respInterno?: string | null;

  @Column({ type: 'text', default: 'Activa' })
  estado!: string;

  @Column({ type: 'date', nullable: true })
  fechaCreacion?: string | null;

  @Column({ type: 'text', nullable: true })
  motivoAnulacion?: string | null;

  @Column({ type: 'int', default: 1 })
  version!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
