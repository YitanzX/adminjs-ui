import express, { type Express } from 'express';
import type { ComponentLoader } from 'adminjs';
import type { DataSource } from 'typeorm';

import { DEFAULT_ACCEPT, DEFAULT_MAX_FILE_SIZE_BYTES, DEFAULT_UPLOAD_PATH } from './shared.js';
import { adminSessionGuard } from './server/session-guard.js';
import { createUploadRouter, type ResolvedUploadConfig } from './server/upload-router.js';
import { base64StorageAdapter } from './storage/base64.js';
import { localDiskStorageAdapter } from './storage/local-disk.js';
import type { StorageAdapter } from './storage/index.js';
import { createSettingsFeature, type SettingsFeature } from './settings/feature.js';
import { typeormSettingsStore } from './settings/typeorm-store.js';
import type { SettingsStore } from './settings/store.js';
import type { BrandingDefaults, UploadDefaults, UploadStorageKind } from './settings/schema.js';
import { createMediaFeature, type MediaFeature } from './media/feature.js';
import { typeormMediaStore } from './media/typeorm-store.js';
import type { MediaStore } from './media/store.js';
import { ADMINJS_UI_ENTITIES, AdminUiSetting, MediaItem } from './entities.js';

export interface SettingsInstallConfig {
  store?: SettingsStore;
  brandingDefaults?: BrandingDefaults;
  uploadDefaults?: UploadDefaults;
  /** Extra static `BrandingOptions` merged into the computed branding. */
  extendBranding?: Record<string, any>;
  pageName?: string;
  label?: string;
  icon?: string;
  canAccess?: (admin: any) => boolean;
}

export interface MediaInstallConfig {
  store?: MediaStore;
  hardLimitBytes?: number;
  pageName?: string;
  label?: string;
  icon?: string;
  canAccess?: (admin: any) => boolean;
}

export interface UploadInstallConfig {
  /** Generic upload endpoint used by the field widgets. Default `/admin/adminjs-ui/upload`. */
  path?: string;
  hardLimitBytes?: number;
  /** Enables the "localDisk" storage backend and serves it statically. */
  localDisk?: { directory: string; publicPath?: string };
  /** Fully custom kind → adapter mapping (wins over `localDisk`). */
  storageFor?: (kind: UploadStorageKind) => StorageAdapter | undefined;
  /** Fallback constraints when the Settings page is disabled. */
  accept?: string[];
  maxFileSizeBytes?: number;
}

export interface InstallAdminJsUiOptions {
  componentLoader: ComponentLoader;
  /** DataSource that will hold the library's tables (see `ADMINJS_UI_ENTITIES`). */
  dataSource: DataSource;
  /** Settings page config, or `false` to disable it. */
  settings?: false | SettingsInstallConfig;
  /** Media Library config, or `false` to disable it. */
  media?: false | MediaInstallConfig;
  upload?: UploadInstallConfig;
}

export interface AdminJsUi {
  /** Spread into your DataSource `entities`. */
  entities: readonly unknown[];
  /**
   * Merge into your AdminJS options: augments `pages`, sets `branding` (unless
   * you set your own), attaches the `componentLoader`, and strips the library's
   * own auto-generated resources.
   */
  applyOptions: <T extends Record<string, any>>(options: T) => T;
  /** Mount everything on your express app (settings + media APIs, upload endpoint, static host). */
  mount: (app: Express, options?: { rootPath?: string }) => void;
  /** AdminJS feature turning properties into Media Library pickers. */
  mediaField: MediaFeature['field'];
  /** Pass to `createUploadRouter` if you mount your own. */
  resolveUploadConfig: (req: unknown) => Promise<ResolvedUploadConfig>;
  settings?: SettingsFeature;
  media?: MediaFeature;
}

/**
 * One call that wires the whole library into an AdminJS + express + TypeORM app.
 * The host only needs three mechanical hookups afterwards:
 *   - `entities: [...mine, ...ui.entities]` in the DataSource
 *   - `return ui.applyOptions({ ...adminJsOptions })`
 *   - `ui.mount(app)` on the express app
 */
export const installAdminJsUi = (opts: InstallAdminJsUiOptions): AdminJsUi => {
  const { componentLoader, dataSource } = opts;
  const uploadPath = opts.upload?.path ?? DEFAULT_UPLOAD_PATH;
  const hardLimitBytes = opts.upload?.hardLimitBytes ?? 25 * 1024 * 1024;
  const localDisk = opts.upload?.localDisk
    ? {
        directory: opts.upload.localDisk.directory,
        publicPath: opts.upload.localDisk.publicPath ?? '/admin/uploads',
      }
    : null;

  const storageFor = (kind: UploadStorageKind): StorageAdapter => {
    const custom = opts.upload?.storageFor?.(kind);
    if (custom) return custom;
    if (kind === 'localDisk') {
      if (localDisk) return localDiskStorageAdapter(localDisk);
      throw new Error(
        'adminjs-ui: the "localDisk" upload backend is selected but not configured — pass `upload.localDisk`.',
      );
    }
    return base64StorageAdapter();
  };

  const settingsCfg: SettingsInstallConfig = opts.settings || {};
  const settings =
    opts.settings === false
      ? undefined
      : createSettingsFeature({
          componentLoader,
          store: settingsCfg.store ?? typeormSettingsStore(dataSource),
          storageFor,
          uploadPath,
          brandingDefaults: settingsCfg.brandingDefaults,
          uploadDefaults: settingsCfg.uploadDefaults,
          extendBranding: settingsCfg.extendBranding,
          pageName: settingsCfg.pageName,
          label: settingsCfg.label,
          icon: settingsCfg.icon,
          canAccess: settingsCfg.canAccess,
        });

  const resolveUploadConfig: (req: unknown) => Promise<ResolvedUploadConfig> = settings
    ? () => Promise.resolve(settings.resolveUploadConfig())
    : async () => ({
        storage: storageFor('base64'),
        accept: opts.upload?.accept ?? DEFAULT_ACCEPT,
        maxFileSizeBytes: opts.upload?.maxFileSizeBytes ?? DEFAULT_MAX_FILE_SIZE_BYTES,
      });

  const mediaCfg: MediaInstallConfig = opts.media || {};
  const media =
    opts.media === false
      ? undefined
      : createMediaFeature({
          componentLoader,
          store: mediaCfg.store ?? typeormMediaStore(dataSource),
          resolveConfig: () => resolveUploadConfig(undefined),
          hardLimitBytes: mediaCfg.hardLimitBytes,
          pageName: mediaCfg.pageName,
          label: mediaCfg.label,
          icon: mediaCfg.icon,
          canAccess: mediaCfg.canAccess,
        });

  const managed = new Set<unknown>([AdminUiSetting, MediaItem]);
  const isManagedResource = (entry: any): boolean =>
    managed.has(entry?.resource) || ['AdminUiSetting', 'MediaItem'].includes(entry?.resource?.name);

  return {
    entities: ADMINJS_UI_ENTITIES,
    mediaField: media ? media.field : () => (resourceOptions: Record<string, any>) => resourceOptions,
    resolveUploadConfig,
    settings,
    media,

    applyOptions(options) {
      const merged: Record<string, any> = {
        ...options,
        componentLoader: options.componentLoader ?? componentLoader,
        pages: { ...(options.pages ?? {}), ...(settings?.pages ?? {}), ...(media?.pages ?? {}) },
      };
      if (!options.branding && settings) merged.branding = settings.resolveBranding;
      if (Array.isArray(options.resources)) {
        merged.resources = options.resources.filter((entry: any) => !isManagedResource(entry));
      }
      return merged as typeof options;
    },

    mount(app: Express) {
      if (settings) app.use(settings.router);
      if (media) app.use(media.router);
      if (localDisk) app.use(localDisk.publicPath, express.static(localDisk.directory));
      app.use(
        uploadPath,
        adminSessionGuard(),
        createUploadRouter({ resolveConfig: resolveUploadConfig, hardLimitBytes }),
      );
    },
  };
};
