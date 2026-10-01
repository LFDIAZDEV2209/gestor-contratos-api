import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Bitácora inmutable (files/02 · audit). INSERT-only: la migración crea un trigger
 * que bloquea UPDATE y DELETE a nivel de base de datos, con hash encadenado por registro.
 */
@Entity('audit_log')
@Index('ix_audit_contract', ['contractId'])
@Index('ix_audit_usuario', ['usuario'])
@Index('ix_audit_fecha', ['fecha'])
@Index('ix_audit_modulo', ['modulo'])
@Index('ix_audit_accion', ['accion'])
export class AuditLogEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ type: 'timestamptz' })
  ts!: Date;

  @Column({ type: 'text' })
  fecha!: string;

  @Column({ type: 'text' })
  hora!: string;

  @Column({ type: 'text' })
  usuario!: string;

  @Column({ type: 'text' })
  rol!: string;

  @Column({ type: 'text', nullable: true })
  contractId?: string | null;

  @Column({ type: 'text' })
  modulo!: string;

  @Column({ type: 'text' })
  accion!: string;

  @Column({ type: 'text', nullable: true })
  campo?: string | null;

  @Column({ type: 'text', nullable: true })
  anterior?: string | null;

  @Column({ type: 'text', nullable: true })
  nuevo?: string | null;

  @Column({ type: 'text', nullable: true })
  ip?: string | null;

  @Column({ type: 'text', nullable: true })
  obs?: string | null;

  @Column({ type: 'text' })
  hash!: string;
}
