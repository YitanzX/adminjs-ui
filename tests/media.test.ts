import test from 'node:test';
import assert from 'node:assert/strict';

import {
  mediaKindOf,
  mimePrefixForKind,
  type MediaItemDTO,
} from '../media/types.js';
import { filterMediaList, memoryMediaStore } from '../media/store.js';

const item = (over: Partial<MediaItemDTO>): MediaItemDTO => ({
  id: '1',
  url: 'u',
  storageKey: null,
  name: 'file.bin',
  mime: 'application/octet-stream',
  size: 1,
  width: null,
  height: null,
  alt: null,
  title: null,
  createdByEmail: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  ...over,
});

test('mediaKindOf / mimePrefixForKind classify by mime', () => {
  assert.equal(mediaKindOf('image/png'), 'image');
  assert.equal(mediaKindOf('video/mp4'), 'video');
  assert.equal(mediaKindOf('audio/mpeg'), 'audio');
  assert.equal(mediaKindOf('application/pdf'), 'document');
  assert.equal(mimePrefixForKind('image'), 'image/');
  assert.equal(mimePrefixForKind('document'), '');
});

test('filterMediaList filters by kind and search, sorts newest-first and paginates', () => {
  const all = [
    item({ id: '1', name: 'alpha.png', mime: 'image/png', createdAt: '2026-01-01T00:00:00.000Z' }),
    item({ id: '2', name: 'beta.pdf', mime: 'application/pdf', createdAt: '2026-02-01T00:00:00.000Z' }),
    item({ id: '3', name: 'gamma.jpg', mime: 'image/jpeg', alt: 'alpha cat', createdAt: '2026-03-01T00:00:00.000Z' }),
  ];

  const images = filterMediaList(all, { kind: 'image' });
  assert.deepEqual(images.items.map((entry) => entry.id), ['3', '1']); // newest first
  assert.equal(images.total, 2);

  const searched = filterMediaList(all, { search: 'alpha' });
  assert.deepEqual(searched.items.map((entry) => entry.id).sort(), ['1', '3']);

  const paged = filterMediaList(all, { pageSize: 1, page: 2 });
  assert.equal(paged.items.length, 1);
  assert.equal(paged.items[0].id, '2');
  assert.equal(paged.total, 3);
});

test('memoryMediaStore supports create / get / update / remove / list', async () => {
  const store = memoryMediaStore();
  const created = await store.create({ url: 'x', name: 'x.png', mime: 'image/png', size: 10 });
  assert.equal(created.id, '1');
  assert.equal((await store.get('1'))?.name, 'x.png');

  const updated = await store.update('1', { alt: 'a cat', title: 'Cat' });
  assert.equal(updated?.alt, 'a cat');

  const listed = await store.list({});
  assert.equal(listed.total, 1);

  const removed = await store.remove('1');
  assert.equal(removed?.id, '1');
  assert.equal(await store.get('1'), null);
  assert.equal((await store.list({})).total, 0);
});
