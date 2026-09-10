import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Persistence for the Settings page. The library ships in-memory and JSON-file
 * reference stores; a TypeORM-backed store lives in `typeorm-store.ts`. Back it
 * with anything by implementing this interface.
 */
export interface SettingsStore {
  load(): Promise<Record<string, string>>;
  save(patch: Record<string, string>, actor?: { email?: string | null } | null): Promise<void>;
}

/** Non-persistent store — handy for tests and previews. */
export const memorySettingsStore = (initial: Record<string, string> = {}): SettingsStore => {
  const data = { ...initial };
  return {
    async load() {
      return { ...data };
    },
    async save(patch) {
      Object.assign(data, patch);
    },
  };
};

/**
 * Stores the settings as a JSON object in a single file. Zero database coupling.
 * The directory is created on first write; a missing/corrupt file reads as `{}`.
 */
export const jsonFileSettingsStore = (filePath: string): SettingsStore => {
  const resolved = path.resolve(filePath);
  return {
    async load() {
      try {
        const parsed: unknown = JSON.parse(await readFile(resolved, 'utf8'));
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
        const out: Record<string, string> = {};
        for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
          if (typeof value === 'string') out[key] = value;
        }
        return out;
      } catch {
        return {};
      }
    },
    async save(patch) {
      const current = await this.load();
      const next = { ...current, ...patch };
      await mkdir(path.dirname(resolved), { recursive: true });
      await writeFile(resolved, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
    },
  };
};
