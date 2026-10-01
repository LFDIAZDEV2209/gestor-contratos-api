import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

/** Matriz rol × permiso de files/08. El ADMINISTRADOR conserva siempre todos los permisos. */
@Entity('role_permissions')
@Unique('uk_role_permiso', ['rol', 'permiso'])
export class RolePermissionEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ type: 'text' })
  rol!: string;

  @Column({ type: 'text' })
  permiso!: string;

  @Column({ type: 'boolean', default: false })
  habilitado!: boolean;
}
