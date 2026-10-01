import {
  Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn,
} from 'typeorm';

/** Gestión de una alerta calculada, indexada por su clave estable (files/02 · alertState). */
@Entity('alert_state')
export class AlertStateEntity {
  @PrimaryColumn('text')
  alertKey!: string;

  @Column({ type: 'text' })
  estado!: string;

  @Column({ type: 'text', nullable: true })
  delegadoA?: string | null;

  @Column({ type: 'text', nullable: true })
  nota?: string | null;

  @Column({ type: 'text' })
  usuario!: string;

  @Column({ type: 'timestamptz' })
  fechaGestion!: Date;
}

/** Registro de claves ya vistas (una alerta de umbral se notifica una sola vez por cruce). */
@Entity('alert_keys')
export class AlertKeyEntity {
  @PrimaryColumn('text')
  alertKey!: string;

  @Column({ type: 'text' })
  tipo!: string;

  @Column({ type: 'text', nullable: true })
  contractId?: string | null;

  @Column({ type: 'timestamptz' })
  primeraVez!: Date;
}

/** Tareas creadas desde alertas (files/02 · tasks). */
@Entity('tasks')
@Index('ix_tasks_estado', ['estado'])
@Index('ix_tasks_alert', ['alertKey'])
@Index('ix_tasks_contract', ['contractId'])
export class TaskEntity {
  @PrimaryColumn('text')
  id!: string;

  @Column({ type: 'text' })
  titulo!: string;

  @Column({ type: 'text' })
  asignado!: string;

  @Column({ type: 'date', nullable: true })
  vence?: string | null;

  @Column({ type: 'text', nullable: true })
  contractId?: string | null;

  @Column({ type: 'text', nullable: true })
  alertKey?: string | null;

  @Column({ type: 'text', default: 'Abierta' })
  estado!: string;

  @Column({ type: 'text' })
  creadaPor!: string;

  @Column({ type: 'int', default: 1 })
  version!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
