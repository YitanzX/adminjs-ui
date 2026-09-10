import express, { Router } from 'express';
import type { Request } from 'express';
import type { ComponentLoader, PageHandler } from 'adminjs';

import { DEFAULT_UPLOAD_PATH, SETTINGS_API_PATH } from '../shared.js';
import { base64StorageAdapter } from '../storage/base64.js';
import type { StorageAdapter } from '../storage/index.js';
import type { ResolvedUploadConfig } from '../server/upload-router.js';
import {
  brandingOptionsFrom,
  buildDefaults,
  mergeSettings,
  parseBrandingValues,
  parseUploadValues,
  validateSettingsPatch,
  type BrandingDefaults,
  type SettingsKey,
  type UploadDefaults,
  type UploadStorageKind,
} from './schema.js';
import type { SettingsStore } from './store.js';

export { SETTINGS_API_PATH };

export interface CreateSettingsFeatureOptions {
  componentLoader: ComponentLoader;
  store: SettingsStore;
  brandingDefaults?: BrandingDefaults;
  uploadDefaults?: UploadDefaults;
  /** Extra static `BrandingOptions` merged into the computed branding (fonts, extra colours). */
  extendBranding?: Record<string, any>;
  /** Maps the configured storage kind to a `StorageAdapter`. Default: base64 only. */
  storageFor?: (kind: UploadStorageKind) => StorageAdapter;
  /** Endpoint the image widgets upload to. Default `/admin/adminjs-ui/upload`. */
  uploadPath?: string;
  /** AdminJS page key + chrome. */
  pageName?: string;
  label?: string;
  icon?: string;
  /** Access predicate. Default: super admins only. */
  canAccess?: (admin: any) => boolean;
}

export interface SettingsFeature {
  /** Spread into AdminJS `options.pages`. */
  pages: Record<string, { label: string; icon: string; component: string; handler: PageHandler }>;
  /** Mount on the express app: `app.use(feature.router)`. */
  router: Router;
  /** Pass to AdminJS `options.branding`. */
  resolveBranding: () => Promise<Record<string, any>>;
  /** Pass to `createUploadRouter({ resolveConfig })`. */
  resolveUploadConfig: () => Promise<ResolvedUploadConfig>;
  getEffectiveSettings: () => Promise<Record<SettingsKey, string>>;
}

let registeredComponent: string | null = null;

export const createSettingsFeature = (options: CreateSettingsFeatureOptions): SettingsFeature => {
  const {
    componentLoader,
    store,
    extendBranding = {},
    uploadPath = DEFAULT_UPLOAD_PATH,
    pageName = 'settings',
    label = 'Settings',
    icon = 'Settings',
    canAccess = (admin: any) => admin?.isSuperAdmin === true,
  } = options;

  const defaults = buildDefaults(options.brandingDefaults, options.uploadDefaults);
  const storageFor =
    options.storageFor ??
    ((kind: UploadStorageKind): StorageAdapter => {
      if (kind === 'localDisk') {
        throw new Error(
          'createSettingsFeature: pass `storageFor` to support the "localDisk" upload backend.',
        );
      }
      return base64StorageAdapter();
    });

  if (!registeredComponent) {
    registeredComponent = componentLoader.add('AdminjsUiSettingsPage', '../components/settings-page.tsx');
  }
  const component = registeredComponent;

  const effective = async (): Promise<Record<SettingsKey, string>> =>
    mergeSettings(await store.load(), defaults);

  const payload = async () => ({
    forbidden: false,
    settings: await effective(),
    defaults: { ...defaults },
    uploadPath,
  });

  // --- AdminJS page ---------------------------------------------------------
  const handler: PageHandler = async (_request, _response, context) => {
    if (!canAccess((context as any)?.currentAdmin ?? null)) {
      return { forbidden: true, settings: {}, defaults: {}, uploadPath };
    }
    return payload();
  };

  // --- JSON API ----------------------------------------------------------
  const router = Router();
  const guard = (req: Request, res: any, next: any): void => {
    const admin = (req as any).session?.adminUser ?? null;
    if (canAccess(admin)) {
      next();
      return;
    }
    res.status(403).json({ error: 'Not allowed.' });
  };

  router.get(SETTINGS_API_PATH, guard, async (_req, res) => {
    try {
      res.json(await payload());
    } catch (error) {
      console.error('[adminjs-ui] settings load failed', error);
      res.status(500).json({ error: 'Unable to load settings.' });
    }
  });

  router.post(SETTINGS_API_PATH, guard, express.json({ limit: '12mb' }), async (req: Request, res: any) => {
    try {
      const result = validateSettingsPatch((req.body as Record<string, unknown>) ?? {});
      if (!result.ok) {
        res.status(400).json({ error: result.error });
        return;
      }
      await store.save(result.clean, (req as any).session?.adminUser ?? null);
      res.json({ ...(await payload()), success: 'Settings saved.' });
    } catch (error) {
      console.error('[adminjs-ui] settings save failed', error);
      res.status(500).json({ error: 'Unable to save settings.' });
    }
  });

  // --- Resolvers for the host ----------------------------------------------
  const resolveBranding = async (): Promise<Record<string, any>> => {
    try {
      return brandingOptionsFrom(parseBrandingValues(await effective()), extendBranding);
    } catch {
      return brandingOptionsFrom(parseBrandingValues(defaults), extendBranding);
    }
  };

  const resolveUploadConfig = async (): Promise<ResolvedUploadConfig> => {
    const upload = parseUploadValues(await effective());
    return {
      storage: storageFor(upload.storage),
      accept: upload.accept,
      maxFileSizeBytes: upload.maxFileSizeBytes,
    };
  };

  return {
    pages: { [pageName]: { label, icon, component, handler } },
    router,
    resolveBranding,
    resolveUploadConfig,
    getEffectiveSettings: effective,
  };
};
