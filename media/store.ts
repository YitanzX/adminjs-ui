import {
  DEFAULT_MEDIA_PAGE_SIZE,
  mediaKindOf,
  type MediaItemDTO,
  type MediaListQuery,
  type MediaListResult,
  type NewMediaItem,
} from './types.js';

/**
 * Persistence for the Media Library. `typeormMediaStore` (see `typeorm-store.ts`)
 * is the reference implementation; back it with anything by implementing this.
 */
export interface MediaStore {
  list(query: MediaListQuery): Promise<MediaListResult>;
  get(id: string): Promise<MediaItemDTO | null>;
  create(input: NewMediaItem): Promise<MediaItemDTO>;
  update(id: string, patch: Partial<Pick<MediaItemDTO, 'alt' | 'title'>>): Promise<MediaItemDTO | null>;
  /** Removes the row and returns it, so the caller can drop it from storage too. */
  remove(id: string): Promise<MediaItemDTO | null>;
}

const clampPage = (query: MediaListQuery): { page: number; pageSize: number } => {
  const pageSize = Math.min(Math.max(Math.trunc(query.pageSize || DEFAULT_MEDIA_PAGE_SIZE), 1), 200);
  const page = Math.max(Math.trunc(query.page || 1), 1);
  return { page, pageSize };
};

/** Filters + paginates an already-loaded list (shared by the memory store and tests). */
export const filterMediaList = (all: MediaItemDTO[], query: MediaListQuery): MediaListResult => {
  const { page, pageSize } = clampPage(query);
  const search = (query.search ?? '').trim().toLowerCase();
  const kind = query.kind && query.kind !== 'all' ? query.kind : null;

  const matched = all
    .filter((item) => (kind ? mediaKindOf(item.mime) === kind : true))
    .filter((item) =>
      search
        ? item.name.toLowerCase().includes(search) ||
          (item.alt ?? '').toLowerCase().includes(search) ||
          (item.title ?? '').toLowerCase().includes(search)
        : true,
    )
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));

  const start = (page - 1) * pageSize;
  return { items: matched.slice(start, start + pageSize), total: matched.length, page, pageSize };
};

/** Non-persistent store — handy for tests and previews. */
export const memoryMediaStore = (seed: MediaItemDTO[] = []): MediaStore => {
  const rows = [...seed];
  let nextId = rows.reduce((max, row) => Math.max(max, Number(row.id) || 0), 0) + 1;

  return {
    async list(query) {
      return filterMediaList(rows, query);
    },
    async get(id) {
      return rows.find((row) => row.id === String(id)) ?? null;
    },
    async create(input) {
      const item: MediaItemDTO = {
        id: String(nextId++),
        url: input.url,
        storageKey: input.storageKey ?? null,
        name: input.name,
        mime: input.mime,
        size: input.size,
        width: input.width ?? null,
        height: input.height ?? null,
        alt: input.alt ?? null,
        title: input.title ?? null,
        createdByEmail: input.createdByEmail ?? null,
        createdAt: new Date().toISOString(),
      };
      rows.unshift(item);
      return item;
    },
    async update(id, patch) {
      const row = rows.find((entry) => entry.id === String(id));
      if (!row) return null;
      if (patch.alt !== undefined) row.alt = patch.alt;
      if (patch.title !== undefined) row.title = patch.title;
      return row;
    },
    async remove(id) {
      const index = rows.findIndex((row) => row.id === String(id));
      if (index < 0) return null;
      return rows.splice(index, 1)[0];
    },
  };
};
