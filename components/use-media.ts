/// <reference lib="dom" />
// Browser-only: Media Library data helpers + a small browser hook.

import React from 'react';

import {
  DEFAULT_MEDIA_PAGE_SIZE,
  MEDIA_API_PATH,
  type MediaItemDTO,
  type MediaKind,
  type MediaListResult,
} from '../media/types.js';

const asJson = async (response: Response): Promise<any> => {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error ?? `Request failed (${response.status}).`);
  return body;
};

export const fetchMedia = (params: {
  search?: string;
  kind?: MediaKind | 'all';
  page?: number;
  pageSize?: number;
}): Promise<MediaListResult> => {
  const query = new URLSearchParams();
  if (params.search) query.set('search', params.search);
  if (params.kind && params.kind !== 'all') query.set('kind', params.kind);
  query.set('page', String(params.page ?? 1));
  query.set('pageSize', String(params.pageSize ?? DEFAULT_MEDIA_PAGE_SIZE));
  return fetch(`${MEDIA_API_PATH}?${query.toString()}`, { credentials: 'include' }).then(asJson);
};

export const patchMedia = (
  id: string,
  patch: { alt?: string | null; title?: string | null },
): Promise<MediaItemDTO> =>
  fetch(`${MEDIA_API_PATH}/${id}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  }).then(asJson);

export const deleteMedia = (id: string): Promise<void> =>
  fetch(`${MEDIA_API_PATH}/${id}`, { method: 'DELETE', credentials: 'include' }).then((response) => {
    if (!response.ok && response.status !== 204) throw new Error('Unable to delete.');
  });

export interface MediaBrowser {
  items: MediaItemDTO[];
  total: number;
  loading: boolean;
  error: string | null;
  search: string;
  kind: MediaKind | 'all';
  hasMore: boolean;
  setSearch: (value: string) => void;
  setKind: (value: MediaKind | 'all') => void;
  loadMore: () => void;
  reload: () => void;
  prepend: (item: MediaItemDTO) => void;
  replace: (item: MediaItemDTO) => void;
  removeLocal: (id: string) => void;
}

export const useMediaBrowser = (pageSize = DEFAULT_MEDIA_PAGE_SIZE): MediaBrowser => {
  const [items, setItems] = React.useState<MediaItemDTO[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearchState] = React.useState('');
  const [kind, setKindState] = React.useState<MediaKind | 'all'>('all');
  const reqId = React.useRef(0);

  const run = React.useCallback(
    (nextPage: number, mode: 'replace' | 'append') => {
      const id = ++reqId.current;
      setLoading(true);
      setError(null);
      fetchMedia({ search, kind, page: nextPage, pageSize })
        .then((result) => {
          if (id !== reqId.current) return;
          setTotal(result.total);
          setPage(result.page);
          setItems((current) => (mode === 'append' ? [...current, ...result.items] : result.items));
        })
        .catch((err: Error) => id === reqId.current && setError(err.message))
        .finally(() => id === reqId.current && setLoading(false));
    },
    [search, kind, pageSize],
  );

  React.useEffect(() => {
    run(1, 'replace');
  }, [run]);

  return {
    items,
    total,
    loading,
    error,
    search,
    kind,
    hasMore: items.length < total,
    setSearch: setSearchState,
    setKind: setKindState,
    loadMore: () => run(page + 1, 'append'),
    reload: () => run(1, 'replace'),
    prepend: (item) => {
      setItems((current) => [item, ...current.filter((entry) => entry.id !== item.id)]);
      setTotal((current) => current + 1);
    },
    replace: (item) =>
      setItems((current) => current.map((entry) => (entry.id === item.id ? item : entry))),
    removeLocal: (id) => {
      setItems((current) => current.filter((entry) => entry.id !== id));
      setTotal((current) => Math.max(0, current - 1));
    },
  };
};
