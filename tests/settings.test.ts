import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  brandingOptionsFrom,
  buildDefaults,
  mergeSettings,
  parseBrandingValues,
  parseUploadValues,
  tintColor,
  validateSettingsPatch,
} from '../settings/schema.js';
import { jsonFileSettingsStore, memorySettingsStore } from '../settings/store.js';

test('buildDefaults overlays branding/upload overrides and ignores bad colours', () => {
  const d = buildDefaults(
    { companyName: 'Yitanz', primaryColor: '#123abc', accentColor: 'red' },
    { storage: 'localDisk', maxFileSizeMb: 8, imagesOnly: false },
  );
  assert.equal(d['branding.companyName'], 'Yitanz');
  assert.equal(d['branding.primaryColor'], '#123abc');
  assert.equal(d['branding.accentColor'], '#1c1c1c'); // invalid → fallback
  assert.equal(d['upload.storage'], 'localDisk');
  assert.equal(d['upload.maxFileSizeMb'], '8');
  assert.equal(d['upload.imagesOnly'], 'false');
});

test('mergeSettings overlays stored values on the defaults, dropping empty/unknown', () => {
  const defaults = buildDefaults({ companyName: 'Base' });
  const merged = mergeSettings({ 'branding.companyName': 'Stored', 'branding.logo': '', 'x.y': 'z' }, defaults);
  assert.equal(merged['branding.companyName'], 'Stored');
  assert.equal(merged['branding.logo'], defaults['branding.logo']);
  assert.equal('x.y' in merged, false);
});

test('parseUploadValues resolves backend, clamps size and maps accept', () => {
  const defaults = buildDefaults();
  const a = parseUploadValues(mergeSettings({ 'upload.storage': 'localDisk', 'upload.maxFileSizeMb': '9' }, defaults));
  assert.equal(a.storage, 'localDisk');
  assert.equal(a.maxFileSizeBytes, 9 * 1024 * 1024);
  assert.deepEqual(a.accept, ['image/']);

  const b = parseUploadValues(mergeSettings({ 'upload.maxFileSizeMb': '999', 'upload.imagesOnly': 'false' }, defaults));
  assert.equal(b.maxFileSizeBytes, 25 * 1024 * 1024);
  assert.deepEqual(b.accept, []);
});

test('validateSettingsPatch rejects invalid values', () => {
  assert.equal(validateSettingsPatch({ 'branding.companyName': '  ' }).ok, false);
  assert.equal(validateSettingsPatch({ 'branding.primaryColor': 'nope' }).ok, false);
  assert.equal(validateSettingsPatch({ 'upload.storage': 'ftp' }).ok, false);
  assert.equal(validateSettingsPatch({ 'upload.maxFileSizeMb': '0' }).ok, false);
  assert.equal(validateSettingsPatch({ 'upload.maxFileSizeMb': '40' }).ok, false);
  const big = `data:image/png;base64,${'A'.repeat(8 * 1024 * 1024)}`;
  assert.equal(validateSettingsPatch({ 'branding.logo': big }).ok, false);
});

test('validateSettingsPatch returns cleaned values and drops unknown keys', () => {
  const result = validateSettingsPatch({
    'branding.companyName': '  Yitanz CMS  ',
    'branding.primaryColor': '#AABBCC',
    'upload.imagesOnly': 'on',
    'nope.ignored': 'x',
  });
  assert.ok(result.ok);
  if (result.ok) {
    assert.equal(result.clean['branding.companyName'], 'Yitanz CMS');
    assert.equal(result.clean['branding.primaryColor'], '#aabbcc');
    assert.equal(result.clean['upload.imagesOnly'], 'true');
    assert.equal('nope.ignored' in result.clean, false);
  }
});

test('brandingOptionsFrom builds a tint ramp and merges a static extension', () => {
  const branding = parseBrandingValues(buildDefaults({ primaryColor: '#f5b700' }));
  const options = brandingOptionsFrom(branding, { theme: { fonts: { base: 'Inter' } } });
  assert.equal(options.theme.colors.primary100, '#f5b700');
  assert.equal(options.theme.colors.primary20, tintColor('#f5b700', 0.9));
  assert.equal(options.theme.fonts.base, 'Inter');
});

test('memorySettingsStore round-trips a patch', async () => {
  const store = memorySettingsStore({ a: '1' });
  await store.save({ b: '2' });
  assert.deepEqual(await store.load(), { a: '1', b: '2' });
});

test('jsonFileSettingsStore persists to disk and tolerates a missing file', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'adminjs-ui-settings-'));
  try {
    const store = jsonFileSettingsStore(path.join(dir, 'nested', 'settings.json'));
    assert.deepEqual(await store.load(), {});
    await store.save({ 'branding.companyName': 'Yitanz' });
    await store.save({ 'upload.storage': 'localDisk' });
    assert.deepEqual(await store.load(), {
      'branding.companyName': 'Yitanz',
      'upload.storage': 'localDisk',
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
