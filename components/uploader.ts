/// <reference lib="dom" />
// Browser-only module: runs inside the AdminJS component bundle.

import type { StoredFile } from '../shared.js';

export interface UploadHandle {
  promise: Promise<StoredFile>;
  abort: () => void;
}

/**
 * Sends one blob to the upload route as the raw request body, reporting progress
 * through `onProgress` (0..1). Returns the created `StoredFile`.
 */
export const uploadBlob = (
  uploadPath: string,
  blob: Blob,
  fileName: string,
  onProgress: (fraction: number) => void,
): UploadHandle => {
  const xhr = new XMLHttpRequest();

  const promise = new Promise<StoredFile>((resolve, reject) => {
    xhr.open('POST', uploadPath, true);
    xhr.withCredentials = true;
    xhr.setRequestHeader('Content-Type', blob.type || 'application/octet-stream');
    xhr.setRequestHeader('X-File-Name', encodeURIComponent(fileName));

    xhr.upload.onprogress = (event: ProgressEvent): void => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    xhr.onload = (): void => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as StoredFile);
        } catch {
          reject(new Error('The upload server returned an unexpected response.'));
        }
        return;
      }
      let message = `Upload failed (${xhr.status}).`;
      try {
        message = (JSON.parse(xhr.responseText) as { message?: string }).message ?? message;
      } catch {
        /* keep default message */
      }
      reject(new Error(message));
    };
    xhr.onerror = (): void => reject(new Error('Network error during upload.'));
    xhr.onabort = (): void => reject(new Error('Upload cancelled.'));

    xhr.send(blob);
  });

  return { promise, abort: () => xhr.abort() };
};

/** Fire-and-forget delete of a previously stored file. */
export const deleteStored = (deletePath: string, key: string): void => {
  if (!key) return;
  void fetch(deletePath, {
    method: 'DELETE',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key }),
  }).catch(() => undefined);
};
