import { randomUUID } from 'node:crypto';

import type { StoredFile } from '../shared.js';
import type { IncomingFile, StorageAdapter } from './index.js';

export interface S3Options {
  /** A configured `@aws-sdk/client-s3` `S3Client` instance. */
  client: unknown;
  bucket: string;
  /** Key prefix inside the bucket, e.g. `admin-uploads/`. */
  keyPrefix?: string;
  /**
   * Base URL the objects are publicly reachable at (CDN or bucket website).
   * `${publicBaseUrl}/${key}` must resolve to the object.
   */
  publicBaseUrl: string;
  acl?: string;
}

// `@aws-sdk/client-s3` is an optional peer dependency. The specifier is typed as
// `string` on purpose so TypeScript treats the import as fully dynamic and does
// not require the module to be installed here.
const S3_SDK: string = '@aws-sdk/client-s3';

const loadSdk = async (): Promise<any> => {
  try {
    return await import(S3_SDK);
  } catch {
    throw new Error(
      's3StorageAdapter requires "@aws-sdk/client-s3". Install it in your app or use a different storage adapter.',
    );
  }
};

/**
 * Uploads to an S3-compatible bucket. Pass an already-constructed `S3Client` as
 * `client` so this adapter stays SDK-version agnostic.
 */
export const s3StorageAdapter = (options: S3Options): StorageAdapter => {
  const { client, bucket, publicBaseUrl, acl } = options;
  const keyPrefix = (options.keyPrefix ?? '').replace(/^\/+/, '');
  const urlBase = publicBaseUrl.replace(/\/+$/, '');
  const send = (command: unknown): Promise<unknown> =>
    (client as { send: (command: unknown) => Promise<unknown> }).send(command);

  return {
    async save(file: IncomingFile): Promise<StoredFile> {
      const { PutObjectCommand } = await loadSdk();
      const key = `${keyPrefix}${randomUUID()}`;
      await send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: file.buffer,
          ContentType: file.mime,
          ...(acl ? { ACL: acl } : {}),
        }),
      );
      return {
        url: `${urlBase}/${key}`,
        key,
        name: file.name,
        size: file.buffer.length,
        mime: file.mime,
        width: file.width,
        height: file.height,
      };
    },
    async delete(key: string): Promise<void> {
      const sdk = await loadSdk().catch(() => null);
      if (!sdk) return;
      await send(new sdk.DeleteObjectCommand({ Bucket: bucket, Key: key })).catch(() => undefined);
    },
  };
};
