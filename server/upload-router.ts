import express, { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';

import { DEFAULT_ACCEPT, DEFAULT_MAX_FILE_SIZE_BYTES, type StoredFile } from '../shared.js';
import type { StorageAdapter } from '../storage/index.js';
import { imageDimensions } from './image-dimensions.js';
import { readFileName, validateUpload } from './validate-upload.js';

export interface ResolvedUploadConfig {
  storage: StorageAdapter;
  accept: string[];
  maxFileSizeBytes: number;
}

export interface UploadRouterOptions {
  /** Static storage adapter. Ignored when `resolveConfig` is provided. */
  storage?: StorageAdapter;
  /** Allowed mime prefixes / exact types. Defaults to `['image/']`. */
  accept?: string[];
  maxFileSizeBytes?: number;
  /**
   * Resolve storage + limits per request — use it to drive the upload target
   * and constraints from settings that can change at runtime.
   */
  resolveConfig?: (req: Request) => Promise<ResolvedUploadConfig> | ResolvedUploadConfig;
  /**
   * Absolute ceiling for the raw body parser, independent of the (possibly
   * lower, possibly runtime-configured) `maxFileSizeBytes`. Default 25 MB.
   */
  hardLimitBytes?: number;
  /**
   * Called after a successful `storage.save`. Return an object to merge extra
   * fields into the JSON response (e.g. a media-library id). Used by the Media
   * Library to register every upload.
   */
  onStored?: (stored: StoredFile, req: Request) => Promise<Record<string, unknown> | void> | Record<string, unknown> | void;
}

/**
 * Express router for the upload widgets. Mount it behind `adminSessionGuard`:
 *
 * ```ts
 * app.use('/admin/adminjs-ui/upload', adminSessionGuard(), createUploadRouter({ storage }));
 * ```
 *
 * One file per request as the raw body, file name in `X-File-Name`, so browser
 * upload-progress events work without a multipart parser.
 */
export const createUploadRouter = (options: UploadRouterOptions): Router => {
  const staticAccept = options.accept ?? DEFAULT_ACCEPT;
  const staticMax = options.maxFileSizeBytes ?? DEFAULT_MAX_FILE_SIZE_BYTES;
  const hardLimit = options.hardLimitBytes ?? 25 * 1024 * 1024;

  const resolve = async (req: Request): Promise<ResolvedUploadConfig> => {
    if (options.resolveConfig) return options.resolveConfig(req);
    if (!options.storage) throw new Error('createUploadRouter needs `storage` or `resolveConfig`.');
    return { storage: options.storage, accept: staticAccept, maxFileSizeBytes: staticMax };
  };

  const router = Router();

  router.post(
    '/',
    express.raw({ type: () => true, limit: hardLimit }),
    async (req: Request, res: Response) => {
      try {
        const { storage, accept, maxFileSizeBytes } = await resolve(req);
        const buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
        const mime = String(req.headers['content-type'] ?? '').split(';')[0].trim();
        const name = readFileName(req.headers['x-file-name']);

        const error = validateUpload({ buffer, mime, name }, { accept, maxFileSizeBytes });
        if (error) {
          res.status(400).json({ message: error });
          return;
        }

        const stored = await storage.save({ buffer, name, mime, ...imageDimensions(buffer, mime) });
        const extra = options.onStored ? await options.onStored(stored, req) : undefined;
        res.status(201).json(extra ? { ...stored, ...extra } : stored);
      } catch (err) {
        console.error('[adminjs-ui] upload failed', err);
        res.status(500).json({ message: 'Upload failed.' });
      }
    },
  );

  router.delete('/', express.json(), async (req: Request, res: Response) => {
    try {
      const key = String((req.body as { key?: unknown } | undefined)?.key ?? '');
      if (key) {
        const { storage } = await resolve(req);
        await storage.delete(key);
      }
      res.status(204).end();
    } catch (err) {
      console.error('[adminjs-ui] delete failed', err);
      res.status(500).json({ message: 'Delete failed.' });
    }
  });

  router.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    const status =
      (err as { status?: number })?.status ?? (err as { statusCode?: number })?.statusCode;
    if ((err as { type?: string })?.type === 'entity.too.large' || status === 413) {
      res.status(413).json({ message: `File is larger than the ${(hardLimit / (1024 * 1024)).toFixed(0)} MB limit.` });
      return;
    }
    next(err);
  });

  return router;
};
