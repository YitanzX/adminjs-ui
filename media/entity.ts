import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Library-owned Media Library table. To use `typeormMediaStore`, add this class
 * to your DataSource `entities` — nothing else in your app needs to know it.
 */
@Entity({ name: 'adminjs_ui_media' })
export class MediaItem extends BaseEntity {
  @PrimaryGeneratedColumn({ type: 'int' })
  id!: number;

  @Column({ type: 'varchar', length: 'MAX' })
  url!: string;

  @Column({ name: 'storage_key', type: 'varchar', length: 400, nullable: true })
  storageKey!: string | null;

  @Index()
  @Column({ type: 'varchar', length: 300 })
  name!: string;

  @Column({ type: 'varchar', length: 150 })
  mime!: string;

  @Column({ type: 'int', default: 0 })
  size!: number;

  @Column({ type: 'int', nullable: true })
  width!: number | null;

  @Column({ type: 'int', nullable: true })
  height!: number | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  alt!: string | null;

  @Column({ type: 'varchar', length: 300, nullable: true })
  title!: string | null;

  @Column({ name: 'created_by_email', type: 'varchar', length: 255, nullable: true })
  createdByEmail!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
