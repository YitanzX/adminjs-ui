import type { DataSource } from 'typeorm';

import { MediaItem } from './entity.js';
import type { MediaStore } from './store.js';
import {
  mimePrefixForKind,
  type MediaItemDTO,
  type MediaListQuery,
  type NewMediaItem,
} from './types.js';

const toDTO = (row: MediaItem): MediaItemDTO => ({
  id: String(row.id),
  url: row.url,
  storageKey: row.storageKey ?? null,
  name: row.name,
  mime: row.mime,
  size: row.size ?? 0,
  width: row.width ?? null,
  height: row.height ?? null,
  alt: row.alt ?? null,
  title: row.title ?? null,
  createdByEmail: row.createdByEmail ?? null,
  createdAt: (row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt)).toISOString(),
});

const clampPage = (query: MediaListQuery): { page: number; pageSize: number } => ({
  page: Math.max(Math.trunc(query.page || 1), 1),
  pageSize: Math.min(Math.max(Math.trunc(query.pageSize || 40), 1), 200),
});

/**
 * TypeORM-backed Media Library store. Add `MediaItem` to your DataSource
 * `entities` (with `synchronize` on, or a migration) and pass the DataSource.
 */
export const typeormMediaStore = (dataSource: DataSource): MediaStore => {
  const repo = () => dataSource.getRepository(MediaItem);

  return {
    async list(query) {
      const { page, pageSize } = clampPage(query);
      const qb = repo().createQueryBuilder('m').orderBy('m.createdAt', 'DESC');

      if (query.kind && query.kind !== 'all') {
        const prefix = mimePrefixForKind(query.kind);
        if (prefix) {
          qb.andWhere('m.mime LIKE :mimePrefix', { mimePrefix: `${prefix}%` });
        } else {
          qb.andWhere('m.mime NOT LIKE :img AND m.mime NOT LIKE :vid AND m.mime NOT LIKE :aud', {
            img: 'image/%',
            vid: 'video/%',
            aud: 'audio/%',
          });
        }
      }
      if (query.search?.trim()) {
        qb.andWhere('(m.name LIKE :q OR m.alt LIKE :q OR m.title LIKE :q)', {
          q: `%${query.search.trim()}%`,
        });
      }

      const [rows, total] = await qb
        .skip((page - 1) * pageSize)
        .take(pageSize)
        .getManyAndCount();

      return { items: rows.map(toDTO), total, page, pageSize };
    },

    async get(id) {
      const row = await repo().findOne({ where: { id: Number(id) } });
      return row ? toDTO(row) : null;
    },

    async create(input: NewMediaItem) {
      const row = repo().create({
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
      });
      return toDTO(await repo().save(row));
    },

    async update(id, patch) {
      const row = await repo().findOne({ where: { id: Number(id) } });
      if (!row) return null;
      if (patch.alt !== undefined) row.alt = patch.alt;
      if (patch.title !== undefined) row.title = patch.title;
      return toDTO(await repo().save(row));
    },

    async remove(id) {
      const row = await repo().findOne({ where: { id: Number(id) } });
      if (!row) return null;
      const dto = toDTO(row);
      await repo().remove(row);
      return dto;
    },
  };
};
