import { createHash } from 'node:crypto';

import type { StoredFile } from '../shared.js';
import type { IncomingFile, StorageAdapter } from './index.js';

/**
 * Keeps the file inline as a `data:` URI — no infrastructure, no static route.
 * Good for small images and for parity with the rest of this CMS, which already
 * stores banner/reward images this way. Not suitable for large files.
 */
export const base64StorageAdapter = (): StorageAdapter => ({
  async save(file: IncomingFile): Promise<StoredFile> {
    const key = createHash('sha256').update(file.buffer).digest('hex');
    return {
      url: `data:${file.mime};base64,${file.buffer.toString('base64')}`,
      key,
      name: file.name,
      size: file.buffer.length,
      mime: file.mime,
      width: file.width,
      height: file.height,
    };
  },
  async delete(): Promise<void> {
    // Nothing to clean up — the bytes live in the record itself.
  },
});
