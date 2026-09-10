import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  formatBytes,
  isAcceptedMime,
  parseFileList,
  serializeFileList,
  type StoredFile,
} from '../shared.js';
import { readFileName, validateUpload } from '../server/validate-upload.js';
import { base64StorageAdapter } from '../storage/base64.js';
import { localDiskStorageAdapter } from '../storage/local-disk.js';

const sampleFile: StoredFile = {
  url: 'https://cdn.example/x.png',
  key: 'x',
  name: 'x.png',
  size: 10,
  mime: 'image/png',
};

test('Given a stored file list then it round-trips through serialize/parse', () => {
  const json = serializeFileList([sampleFile]);
  assert.equal(typeof json, 'string');
  assert.deepEqual(parseFileList(json), [sampleFile]);
});

test('Given malformed field values then parseFileList yields an empty list', () => {
  assert.deepEqual(parseFileList(undefined), []);
  assert.deepEqual(parseFileList(''), []);
  assert.deepEqual(parseFileList('not json'), []);
  assert.deepEqual(parseFileList('{"not":"array"}'), []);
  assert.deepEqual(parseFileList('[{"name":"no url"}]'), []);
});

test('Given accept rules then mime prefixes and exact types are matched', () => {
  assert.equal(isAcceptedMime('image/png', ['image/']), true);
  assert.equal(isAcceptedMime('application/pdf', ['image/']), false);
  assert.equal(isAcceptedMime('application/pdf', ['image/', 'application/pdf']), true);
  assert.equal(isAcceptedMime('image/png', []), true);
  assert.equal(isAcceptedMime('', ['image/']), false);
});

test('Given byte counts then formatBytes renders human units', () => {
  assert.equal(formatBytes(0), '0 B');
  assert.equal(formatBytes(512), '512 B');
  assert.equal(formatBytes(1536), '1.5 KB');
  assert.equal(formatBytes(5 * 1024 * 1024), '5 MB');
});

test('Given an upload candidate then validateUpload enforces size and type', () => {
  const constraints = { accept: ['image/'], maxFileSizeBytes: 100 };
  assert.equal(validateUpload({ buffer: Buffer.alloc(0), mime: 'image/png', name: 'a' }, constraints), 'Empty upload.');
  assert.match(
    String(validateUpload({ buffer: Buffer.alloc(200), mime: 'image/png', name: 'a' }, constraints)),
    /larger than/,
  );
  assert.match(
    String(validateUpload({ buffer: Buffer.alloc(10), mime: 'text/plain', name: 'a' }, constraints)),
    /not allowed/,
  );
  assert.equal(validateUpload({ buffer: Buffer.alloc(10), mime: 'image/png', name: 'a' }, constraints), null);
});

test('Given an X-File-Name header then readFileName decodes and sanitises it', () => {
  assert.equal(readFileName('my%20photo.png'), 'my photo.png');
  assert.equal(readFileName('../../etc/passwd'), '.._.._etc_passwd');
  assert.equal(readFileName(undefined), 'upload');
  assert.equal(readFileName(['a.png', 'b.png']), 'a.png');
});

test('Given the base64 adapter then it stores the bytes inline with a stable key', async () => {
  const adapter = base64StorageAdapter();
  const buffer = Buffer.from('hello');
  const a = await adapter.save({ buffer, name: 'h.txt', mime: 'text/plain' });
  const b = await adapter.save({ buffer, name: 'h.txt', mime: 'text/plain' });
  assert.equal(a.url, `data:text/plain;base64,${buffer.toString('base64')}`);
  assert.equal(a.key, b.key);
  assert.equal(a.size, 5);
  await adapter.delete(a.key); // no-op, must not throw
});

test('Given the local-disk adapter then it writes and deletes the file under publicPath', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'adminjs-ui-'));
  try {
    const adapter = localDiskStorageAdapter({ directory: dir, publicPath: '/admin/uploads/' });
    const stored = await adapter.save({ buffer: Buffer.from('img'), name: 'pic.png', mime: 'image/png' });

    assert.ok(stored.url.startsWith('/admin/uploads/'));
    assert.ok(stored.key.endsWith('.png'));
    assert.equal((await readFile(path.join(dir, stored.key))).toString(), 'img');

    await adapter.delete(stored.key);
    await assert.rejects(() => stat(path.join(dir, stored.key)));

    await adapter.delete('../escape.png'); // rejected path, must not throw
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
