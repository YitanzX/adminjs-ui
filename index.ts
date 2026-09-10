/**
 * `@yitanz/adminjs-ui` — customizable field widgets for AdminJS 7.
 *
 * Server entry point. Browser components are registered by the feature factories
 * and bundled by AdminJS itself, so they are never imported from here.
 *
 * The fast path is `installAdminJsUi({ componentLoader, dataSource, ... })` — one
 * call that wires the Settings page, the Media Library, the upload endpoint and
 * branding. See `install.ts`. Everything below is also usable piecemeal.
 *
 * Currently shipping:
 *   - multiFileUploadFeature — drag & drop multi-file upload (JSON array value).
 *   - singleImageFeature / SingleImageInput — one-image picker (URL string
 *     value); `SingleImageInput` can be dropped into custom pages directly.
 *   - createUploadRouter — the shared upload endpoint, with optional
 *     per-request storage + limit resolution.
 *   - createSettingsFeature — a self-contained visual Settings page (branding +
 *     upload backend) with a pluggable `SettingsStore`. Enabling it needs no
 *     app-specific settings code.
 *   - createMediaFeature — a WordPress-style Media Library: a browsable grid
 *     page + a modal picker field, backed by a pluggable `MediaStore`.
 *
 * Planned: rich text (TipTap), async select (react-select), location picker
 * (Leaflet + OSM).
 */

// --- One-call install ------------------------------------------------------

export {
  installAdminJsUi,
  type InstallAdminJsUiOptions,
  type AdminJsUi,
  type SettingsInstallConfig,
  type MediaInstallConfig,
  type UploadInstallConfig,
} from './install.js';
export { ADMINJS_UI_ENTITIES } from './entities.js';
export { adminJsUiNavLinks, type NavLinkContext } from './components/sidebar-links.js';

// --- Piecemeal building blocks -------------------------------------------

export {
  multiFileUploadFeature,
  type MultiFileUploadFeatureOptions,
  type MultiFileFieldOverride,
} from './feature/multi-file-upload.feature.js';

export {
  singleImageFeature,
  type SingleImageFeatureOptions,
  type SingleImageFieldOverride,
} from './feature/single-image.feature.js';

export {
  createUploadRouter,
  type UploadRouterOptions,
  type ResolvedUploadConfig,
} from './server/upload-router.js';
export { adminSessionGuard } from './server/session-guard.js';
export { validateUpload, readFileName } from './server/validate-upload.js';

export {
  base64StorageAdapter,
  localDiskStorageAdapter,
  s3StorageAdapter,
  type StorageAdapter,
  type IncomingFile,
} from './storage/index.js';

export {
  parseFileList,
  serializeFileList,
  isAcceptedMime,
  formatBytes,
  SETTINGS_API_PATH,
  type StoredFile,
  type CropConfig,
  type MultiFileFieldConfig,
} from './shared.js';

// --- Settings page (opt-in, self-contained) ---------------------------------

export {
  createSettingsFeature,
  type CreateSettingsFeatureOptions,
  type SettingsFeature,
} from './settings/feature.js';

export {
  memorySettingsStore,
  jsonFileSettingsStore,
  type SettingsStore,
} from './settings/store.js';

export { typeormSettingsStore } from './settings/typeorm-store.js';
export { AdminUiSetting } from './settings/entity.js';

// --- Media Library (opt-in, self-contained) --------------------------------

export {
  createMediaFeature,
  type CreateMediaFeatureOptions,
  type MediaFeature,
  type MediaFieldOptions,
} from './media/feature.js';

export {
  memoryMediaStore,
  filterMediaList,
  type MediaStore,
} from './media/store.js';

export { typeormMediaStore } from './media/typeorm-store.js';
export { MediaItem } from './media/entity.js';

export {
  mediaKindOf,
  mimePrefixForKind,
  MEDIA_API_PATH,
  MEDIA_UPLOAD_PATH,
  DEFAULT_MEDIA_PAGE_SIZE,
  type MediaItemDTO,
  type NewMediaItem,
  type MediaKind,
  type MediaListQuery,
  type MediaListResult,
} from './media/types.js';

export {
  SETTINGS_KEYS,
  buildDefaults,
  mergeSettings,
  parseBrandingValues,
  parseUploadValues,
  validateSettingsPatch,
  brandingOptionsFrom,
  tintColor,
  type BrandingValues,
  type UploadValues,
  type BrandingDefaults,
  type UploadDefaults,
  type SettingsKey,
  type UploadStorageKind,
} from './settings/schema.js';
