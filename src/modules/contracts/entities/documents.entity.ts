import {
  Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn,
} from 'typeorm';
import { DatosExtraidos } from '../../../engines/reconcile.engine';

/** Documentos por contrato (files/02 · prefijo DOC). Anular conserva todas sus versiones.
 *  Adjuntos polimórficos: contractId para documentos de contrato; refId/refTipo para
 *  soportes de entidades sin contrato (p. ej. cupos de aseguradora). */
@Entity('documents')
@Index('ix_documents_contract', ['contractId'])
@Index('ix_documents_categoria', ['categoria'])
@Index('ix_documents_estado', ['estado'])
@Index('ix_documents_ref', ['refId'])
export class DocumentEntity {
  @PrimaryColumn('text')
  id!: string;

  /** Contrato al que pertenece el documento (null para adjuntos polimórficos). */
  @Column({ type: 'text', nullable: true })
  contractId?: string | null;

  /** Entidad propietaria del adjunto cuando no hay contrato (p. ej. 'cupo' + CP-01). */
  @Column({ type: 'text', nullable: true })
  refId?: string | null;

  /** Tipo de la entidad propietaria (cupo | garantia | tarea | ...). */
  @Column({ type: 'text', nullable: true })
  refTipo?: string | null;

  @Column({ type: 'text' })
  nombre!: string;

  @Column({ type: 'text' })
  categoria!: string;

  @Column({ type: 'text', default: 'Activo' })
  estado!: string;

  @Column({ type: 'text', nullable: true })
  obs?: string | null;

  /** Datos extraídos para la conciliación (solo categoría «Contrato»). */
  @Column({ type: 'jsonb', nullable: true })
  extracted?: DatosExtraidos | null;

  @Column({ type: 'text', nullable: true })
  motivoAnulacion?: string | null;

  @Column({ type: 'int', default: 1 })
  version!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}

/** Versiones de un documento: nunca se eliminan (files/02). */
@Entity('document_versions')
@Index('ix_docversions_document', ['documentId'])
export class DocumentVersionEntity {
  @PrimaryColumn('text')
  id!: string;

  @Column({ type: 'text' })
  documentId!: string;

  /** Número de versión (1..n) dentro del documento. */
  @Column({ type: 'int' })
  v!: number;

  @Column({ type: 'text' })
  fecha!: string;

  @Column({ type: 'text' })
  usuario!: string;

  /** Ruta relativa del archivo en disco. */
  @Column({ type: 'text' })
  archivo!: string;

  @Column({ type: 'text', nullable: true })
  motivo?: string | null;

  @Column({ type: 'text', nullable: true })
  cambios?: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
