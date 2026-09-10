import type { DataSource } from 'typeorm';

import { AdminUiSetting } from './entity.js';
import type { SettingsStore } from './store.js';

/**
 * TypeORM-backed settings store. Add `AdminUiSetting` to your DataSource
 * `entities` (with `synchronize` on, or a migration) and pass the DataSource
 * here. Returns `{}` until the DataSource is initialised.
 */
export const typeormSettingsStore = (dataSource: DataSource): SettingsStore => {
  const repo = () => dataSource.getRepository(AdminUiSetting);

  return {
    async load() {
      if (!dataSource.isInitialized) return {};
      try {
        const rows = await repo().find();
        return rows.reduce<Record<string, string>>((acc, row) => {
          if (row.value != null) acc[row.key] = row.value;
          return acc;
        }, {});
      } catch {
        return {};
      }
    },
    async save(patch, actor) {
      const settingsRepo = repo();
      for (const [key, value] of Object.entries(patch)) {
        const existing = await settingsRepo.findOne({ where: { key } });
        if (existing) {
          existing.value = value;
          existing.updatedByEmail = actor?.email ?? null;
          await settingsRepo.save(existing);
        } else {
          await settingsRepo.save(settingsRepo.create({ key, value, updatedByEmail: actor?.email ?? null }));
        }
      }
    },
  };
};
