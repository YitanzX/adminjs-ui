import { dataUriWithinLimit } from '../shared.js';

/**
 * Settings model for the self-contained Settings page. Two groups:
 *   - `branding.*` — feeds the AdminJS `branding` option.
 *   - `upload.*` — feeds the upload router (storage backend + limits).
 *
 * Pure: no DB, no node. The DB binding is a `SettingsStore` (see `store.ts`).
 */

export type UploadStorageKind = 'base64' | 'localDisk';

export interface BrandingValues {
  companyName: string;
  logo: string;
  favicon: string;
  primaryColor: string;
  accentColor: string;
}

export interface UploadValues {
  storage: UploadStorageKind;
  maxFileSizeBytes: number;
  /** mime prefixes accepted by the upload router; `[]` = anything. */
  accept: string[];
}

export interface BrandingDefaults {
  companyName?: string;
  logo?: string;
  favicon?: string;
  primaryColor?: string;
  accentColor?: string;
}

export interface UploadDefaults {
  storage?: UploadStorageKind;
  maxFileSizeMb?: number;
  imagesOnly?: boolean;
}

export const SETTINGS_KEYS = [
  'branding.companyName',
  'branding.logo',
  'branding.favicon',
  'branding.primaryColor',
  'branding.accentColor',
  'upload.storage',
  'upload.maxFileSizeMb',
  'upload.imagesOnly',
] as const;

export type SettingsKey = (typeof SETTINGS_KEYS)[number];

const FALLBACK_DEFAULTS: Record<SettingsKey, string> = {
  'branding.companyName': 'Admin',
  'branding.logo': '',
  'branding.favicon': '',
  'branding.primaryColor': '#4268f6',
  'branding.accentColor': '#1c1c1c',
  'upload.storage': 'base64',
  'upload.maxFileSizeMb': '5',
  'upload.imagesOnly': 'true',
};

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MIN_UPLOAD_MB = 0.1;
const MAX_UPLOAD_MB = 25;
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

const asBool = (value: string | undefined): boolean =>
  value === 'true' || value === '1' || value === 'on';

/** Builds the effective default map from caller-supplied overrides. */
export const buildDefaults = (
  branding: BrandingDefaults = {},
  upload: UploadDefaults = {},
): Record<SettingsKey, string> => ({
  ...FALLBACK_DEFAULTS,
  'branding.companyName': branding.companyName ?? FALLBACK_DEFAULTS['branding.companyName'],
  'branding.logo': branding.logo ?? FALLBACK_DEFAULTS['branding.logo'],
  'branding.favicon': branding.favicon ?? FALLBACK_DEFAULTS['branding.favicon'],
  'branding.primaryColor':
    branding.primaryColor && HEX_COLOR.test(branding.primaryColor)
      ? branding.primaryColor
      : FALLBACK_DEFAULTS['branding.primaryColor'],
  'branding.accentColor':
    branding.accentColor && HEX_COLOR.test(branding.accentColor)
      ? branding.accentColor
      : FALLBACK_DEFAULTS['branding.accentColor'],
  'upload.storage': upload.storage ?? FALLBACK_DEFAULTS['upload.storage'],
  'upload.maxFileSizeMb': String(upload.maxFileSizeMb ?? FALLBACK_DEFAULTS['upload.maxFileSizeMb']),
  'upload.imagesOnly': String(upload.imagesOnly ?? true),
});

/** Stored values overlaid on the defaults, restricted to known keys. */
export const mergeSettings = (
  stored: Record<string, string | null | undefined>,
  defaults: Record<SettingsKey, string>,
): Record<SettingsKey, string> => {
  const out = { ...defaults };
  for (const key of SETTINGS_KEYS) {
    const value = stored[key];
    if (typeof value === 'string' && value.length > 0) out[key] = value;
  }
  return out;
};

export const parseBrandingValues = (effective: Record<SettingsKey, string>): BrandingValues => ({
  companyName: effective['branding.companyName'] || FALLBACK_DEFAULTS['branding.companyName'],
  logo: effective['branding.logo'] || '',
  favicon: effective['branding.favicon'] || '',
  primaryColor: HEX_COLOR.test(effective['branding.primaryColor'])
    ? effective['branding.primaryColor']
    : FALLBACK_DEFAULTS['branding.primaryColor'],
  accentColor: HEX_COLOR.test(effective['branding.accentColor'])
    ? effective['branding.accentColor']
    : FALLBACK_DEFAULTS['branding.accentColor'],
});

export const parseUploadValues = (effective: Record<SettingsKey, string>): UploadValues => {
  const mb = Number(effective['upload.maxFileSizeMb']);
  const clamped = Number.isFinite(mb) ? Math.min(Math.max(mb, MIN_UPLOAD_MB), MAX_UPLOAD_MB) : 5;
  return {
    storage: effective['upload.storage'] === 'localDisk' ? 'localDisk' : 'base64',
    maxFileSizeBytes: Math.round(clamped * 1024 * 1024),
    accept: asBool(effective['upload.imagesOnly']) ? ['image/'] : [],
  };
};

/** Validates a partial patch of known keys, returning cleaned string values. */
export const validateSettingsPatch = (
  patch: Record<string, unknown>,
): { ok: true; clean: Record<string, string> } | { ok: false; error: string } => {
  const clean: Record<string, string> = {};
  const known = new Set<string>(SETTINGS_KEYS);

  for (const [key, raw] of Object.entries(patch)) {
    if (!known.has(key)) continue;
    const value = typeof raw === 'string' ? raw : String(raw ?? '');

    switch (key as SettingsKey) {
      case 'branding.companyName':
        if (!value.trim()) return { ok: false, error: 'Company name is required.' };
        if (value.length > 120) return { ok: false, error: 'Company name is too long.' };
        clean[key] = value.trim();
        break;
      case 'branding.logo':
      case 'branding.favicon':
        if (value && !dataUriWithinLimit(value, MAX_IMAGE_BYTES)) {
          return { ok: false, error: `Image is larger than ${Math.round(MAX_IMAGE_BYTES / (1024 * 1024))} MB.` };
        }
        clean[key] = value;
        break;
      case 'branding.primaryColor':
      case 'branding.accentColor':
        if (!HEX_COLOR.test(value)) return { ok: false, error: `"${key}" must be a #rrggbb colour.` };
        clean[key] = value.toLowerCase();
        break;
      case 'upload.storage':
        if (value !== 'base64' && value !== 'localDisk') {
          return { ok: false, error: 'Storage must be "base64" or "localDisk".' };
        }
        clean[key] = value;
        break;
      case 'upload.maxFileSizeMb': {
        const mb = Number(value);
        if (!Number.isFinite(mb) || mb < MIN_UPLOAD_MB || mb > MAX_UPLOAD_MB) {
          return { ok: false, error: `Max upload size must be between ${MIN_UPLOAD_MB} and ${MAX_UPLOAD_MB} MB.` };
        }
        clean[key] = String(mb);
        break;
      }
      case 'upload.imagesOnly':
        clean[key] = asBool(value) ? 'true' : 'false';
        break;
      default:
        break;
    }
  }

  return { ok: true, clean };
};

/** #rrggbb tint toward white; `ratio` 0..1. */
export const tintColor = (hex: string, ratio: number): string => {
  const clean = HEX_COLOR.test(hex) ? hex.slice(1) : '4268f6';
  const channels = [0, 2, 4].map((i) => parseInt(clean.slice(i, i + 2), 16));
  const mixed = channels.map((c) => Math.round(c + (255 - c) * ratio));
  return `#${mixed.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
};

/** Full AdminJS `BrandingOptions` derived from branding values + a static extension. */
export const brandingOptionsFrom = (
  values: BrandingValues,
  extend: Record<string, any> = {},
): Record<string, any> => ({
  companyName: values.companyName,
  logo: values.logo || undefined,
  favicon: values.favicon || undefined,
  withMadeWithLove: false,
  ...extend,
  theme: {
    ...(extend.theme ?? {}),
    colors: {
      primary100: values.primaryColor,
      primary80: tintColor(values.primaryColor, 0.35),
      primary60: tintColor(values.primaryColor, 0.6),
      primary40: tintColor(values.primaryColor, 0.75),
      primary20: tintColor(values.primaryColor, 0.9),
      accent: values.accentColor,
      hoverBg: tintColor(values.primaryColor, 0.85),
      ...(extend.theme?.colors ?? {}),
    },
  },
});
