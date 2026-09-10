/** Media Library — environment-agnostic types (browser + server). */

export type MediaKind = 'image' | 'video' | 'audio' | 'document';

export interface MediaItemDTO {
  id: string;
  url: string;
  storageKey: string | null;
  name: string;
  mime: string;
  size: number;
  width: number | null;
  height: number | null;
  alt: string | null;
  title: string | null;
  createdByEmail: string | null;
  createdAt: string;
}

export interface NewMediaItem {
  url: string;
  storageKey?: string | null;
  name: string;
  mime: string;
  size: number;
  width?: number | null;
  height?: number | null;
  alt?: string | null;
  title?: string | null;
  createdByEmail?: string | null;
}

export interface MediaListQuery {
  search?: string;
  kind?: MediaKind | 'all';
  page?: number;
  pageSize?: number;
}

export interface MediaListResult {
  items: MediaItemDTO[];
  total: number;
  page: number;
  pageSize: number;
}

export const DEFAULT_MEDIA_PAGE_SIZE = 40;

/** Fixed endpoints owned by `createMediaFeature().router`. */
export const MEDIA_API_PATH = '/adminjs-ui/api/media';
export const MEDIA_UPLOAD_PATH = '/adminjs-ui/media/upload';

/** Coarse media class from a mime type, matching the library's type filter. */
export const mediaKindOf = (mime: string): MediaKind => {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  return 'document';
};

export const mimePrefixForKind = (kind: MediaKind): string =>
  kind === 'document' ? '' : `${kind}/`;
