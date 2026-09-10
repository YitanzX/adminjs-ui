import { imageSize } from 'image-size';

/** Best-effort pixel dimensions for an image buffer; `{}` when unknown. */
export const imageDimensions = (
  buffer: Buffer,
  mime: string,
): { width?: number; height?: number } => {
  if (!mime.startsWith('image/') || mime === 'image/svg+xml') return {};
  try {
    const { width, height } = imageSize(buffer);
    return Number.isFinite(width) && Number.isFinite(height) ? { width, height } : {};
  } catch {
    return {};
  }
};
