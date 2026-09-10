import type { StoredFile } from '../shared.js';

/** Raw file handed to an adapter by the upload router. */
export interface IncomingFile {
  buffer: Buffer;
  name: string;
  mime: string;
  width?: number;
  height?: number;
}

/**
 * Pluggable persistence target for uploaded files. Ship your own, or use one of
 * the reference adapters (`base64StorageAdapter`, `localDiskStorageAdapter`,
 * `s3StorageAdapter`).
 */
export interface StorageAdapter {
  save(file: IncomingFile): Promise<StoredFile>;
  /** Best-effort cleanup. May be a no-op (e.g. base64). */
  delete(key: string): Promise<void>;
}

export { base64StorageAdapter } from './base64.js';
export { localDiskStorageAdapter } from './local-disk.js';
export { s3StorageAdapter } from './s3.js';
