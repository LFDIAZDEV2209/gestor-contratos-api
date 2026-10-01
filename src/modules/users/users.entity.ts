import {
  Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn,
} from 'typeorm';

/** Usuarios (files/02 · prefijo U). Roles de files/08. */
@Entity('users')
export class UserEntity {
  @PrimaryColumn('text')
  id!: string;

  @Column({ type: 'text' })
  nombre!: string;

  @Column({ type: 'text', unique: true })
  email!: string;

  @Column({ type: 'text' })
  rol!: string;

  @Column({ type: 'text', default: 'Activo' })
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
