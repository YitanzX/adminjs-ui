import { isAcceptedMime } from '../shared.js';

export interface UploadCandidate {
  buffer: Buffer;
  mime: string;
  name: string;
}

export interface UploadConstraints {
  accept: string[];
  maxFileSizeBytes: number;
}

/** Returns an error message when the upload must be rejected, otherwise `null`. */
export const validateUpload = (
  candidate: UploadCandidate,
  constraints: UploadConstraints,
): string | null => {
  const { buffer, mime } = candidate;

  if (!buffer || buffer.length === 0) {
    return 'Empty upload.';
  }
  if (buffer.length > constraints.maxFileSizeBytes) {
    const mb = (constraints.maxFileSizeBytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, '');
    return `File is larger than the ${mb} MB limit.`;
  }
  if (!isAcceptedMime(mime, constraints.accept)) {
    return `File type "${mime || 'unknown'}" is not allowed.`;
  }
  return null;
};

/** Pulls the original file name out of the `X-File-Name` header. */
export const readFileName = (headerValue: string | string[] | undefined): string => {
  const raw = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  if (!raw) return 'upload';
  try {
    return decodeURIComponent(raw).replace(/[/\\]/g, '_').slice(0, 200) || 'upload';
  } catch {
    return 'upload';
  }
};
