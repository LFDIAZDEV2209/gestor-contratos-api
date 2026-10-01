import { Column, CreateDateColumn, Entity, PrimaryColumn, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/** Parámetros configurables (files/05). Fila única (id = 1). */
@Entity('settings')
export class SettingEntity {
  @PrimaryColumn('int')
  id!: number;

  @Column({ type: 'jsonb', default: () => "'[30,15,10,5,3,1]'::jsonb" })
  alertDays!: number[];

  @Column({ type: 'int', default: 5 })
  criticalDays!: number;

  @Column({ type: 'int', default: 15 })
  budgetPct!: number;

  @Column({ type: 'int', default: 20 })
  gapPct!: number;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}

/** Catálogos configurables (11 en files/02). */
@Entity('catalogs')
export class CatalogEntity {
  @PrimaryColumn('text')
  nombre!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}

/** Valores de cada catálogo (3NF: tabla hija ordenada). */
@Entity('catalog_items')
export class CatalogItemEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ type: 'text' })
  catalogNombre!: string;

  @Column({ type: 'text' })
  valor!: string;

  @Column({ type: 'int', default: 0 })
  orden!: number;
}
