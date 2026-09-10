import { BaseEntity, Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/**
 * Library-owned key/value table for the Settings page. To use `typeormSettingsStore`,
 * add this class to your DataSource `entities` array — nothing else in your app
 * needs to know about it.
 */
@Entity({ name: 'adminjs_ui_settings' })
export class AdminUiSetting extends BaseEntity {
  @PrimaryColumn({ type: 'varchar', length: 120 })
  key!: string;

  @Column({ type: 'varchar', length: 'MAX', nullable: true })
  value!: string | null;

  @Column({ name: 'updated_by_email', type: 'varchar', length: 255, nullable: true })
  updatedByEmail!: string | null;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
