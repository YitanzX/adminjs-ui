import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { StoredFile } from '../shared.js';
import type { IncomingFile, StorageAdapter } from './index.js';

const MIME_EXTENSIONS: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/svg+xml': '.svg',
  'image/avif': '.avif',
  'application/pdf': '.pdf',
};

const extensionFor = (name: string, mime: string): string => {
  const fromName = path.extname(name).toLowerCase();
  if (fromName) return fromName;
  return MIME_EXTENSIONS[mime] ?? '';
};

export interface LocalDiskOptions {
  /** Absolute directory the files are written to. */
  directory: string;
  /**
   * URL prefix the files are served from. The consumer is responsible for
   * `app.use(publicPath, express.static(directory))`.
   */
  publicPath: string;
}

/**
 * Writes files to a directory on the server and returns a URL under
 * `publicPath`. The stored `key` is `<uuid><ext>`, which is also the file name
 * on disk, so `delete` just unlinks it.
 */
export const localDiskStorageAdapter = (options: LocalDiskOptions): StorageAdapter => {
  const { directory, publicPath } = options;
  const urlPrefix = publicPath.replace(/\/+$/, '');

  return {
    async save(file: IncomingFile): Promise<StoredFile> {
      await mkdir(directory, { recursive: true });
      const key = `${randomUUID()}${extensionFor(file.name, file.mime)}`;
      await writeFile(path.join(directory, key), file.buffer);
      return {
        url: `${urlPrefix}/${key}`,
        key,
        name: file.name,
        size: file.buffer.length,
        mime: file.mime,
        width: file.width,
        height: file.height,
      };
    },
    async delete(key: string): Promise<void> {
      if (!key || key.includes('/') || key.includes('..')) return;
      await unlink(path.join(directory, key)).catch(() => undefined);
    },
  };
};
