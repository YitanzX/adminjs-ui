/**
 * `@yitanz/adminjs-ui` — shared, environment-agnostic helpers.
 *
 * This module must stay pure (no node builtins, no `process`, no DOM): it is
 * imported both by the browser components and by the server pieces. It is the
 * `lib/`-style layer of the future standalone package.
 */

/** A file that has been persisted by a storage adapter. */
export interface StoredFile {
  /** Public URL (or `data:` URI) the app renders. */
  url: string;
  /** Adapter-internal identifier, used to delete the file later. */
  key: string;
  name: string;
  size: number;
  mime: string;
  width?: number;
  height?: number;
}

/** Options forwarded from the AdminJS feature to the browser component. */
export interface MultiFileFieldConfig {
  uploadPath: string;
  deletePath?: string;
  accept: string[];
  maxFiles: number;
  maxFileSizeBytes: number;
  crop: CropConfig | false;
}

export interface CropConfig {
  /** width / height ratio; omit for free-form. */
  aspect?: number;
  circular?: boolean;
}

export const DEFAULT_ACCEPT = ['image/'];
export const DEFAULT_MAX_FILES = 8;
export const DEFAULT_MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
export const DEFAULT_UPLOAD_PATH = '/admin/adminjs-ui/upload';

/** Fixed JSON endpoint the Settings page talks to (mounted by `createSettingsFeature`). */
export const SETTINGS_API_PATH = '/adminjs-ui/api/settings';

/** `accept` entries ending in `/` match a mime prefix, otherwise an exact type. */
export const isAcceptedMime = (mime: string, accept: string[]): boolean => {
  if (!mime) return false;
  if (!accept || accept.length === 0) return true;
  return accept.some((entry) => (entry.endsWith('/') ? mime.startsWith(entry) : mime === entry));
};

/** Reads the stored JSON string (or array) back into a `StoredFile[]`. */
export const parseFileList = (raw: unknown): StoredFile[] => {
  if (Array.isArray(raw)) return raw.filter(isStoredFile);
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter(isStoredFile) : [];
    } catch {
      return [];
    }
  }
  return [];
};

/** The value shape AdminJS submits back for the field. */
export const serializeFileList = (files: StoredFile[]): string => JSON.stringify(files ?? []);

const isStoredFile = (value: unknown): value is StoredFile =>
  !!value &&
  typeof value === 'object' &&
  typeof (value as StoredFile).url === 'string' &&
  (value as StoredFile).url.length > 0;

/** Approximate decoded byte size of a `data:...;base64,...` string. */
export const approxDataUriBytes = (value: string): number => {
  const comma = value.indexOf(',');
  const payload = comma >= 0 ? value.slice(comma + 1) : value;
  const padding = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((payload.length * 3) / 4) - padding);
};

/** True unless `value` is a data URI over `maxBytes`. */
export const dataUriWithinLimit = (value: string, maxBytes: number): boolean =>
  !value.startsWith('data:') || approxDataUriBytes(value) <= maxBytes;

export const formatBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  const rendered = value >= 10 || exponent === 0 ? String(Math.round(value)) : value.toFixed(1).replace(/\.0$/, '');
  return `${rendered} ${units[exponent]}`;
};
