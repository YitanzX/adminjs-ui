import express, { Router } from 'express';
import type { Request } from 'express';
import type { ComponentLoader, PageHandler } from 'adminjs';

import { adminSessionGuard } from '../server/session-guard.js';
import { createUploadRouter, type ResolvedUploadConfig } from '../server/upload-router.js';
import { MEDIA_API_PATH, MEDIA_UPLOAD_PATH, type MediaKind } from './types.js';
import type { MediaStore } from './store.js';

export interface CreateMediaFeatureOptions {
  componentLoader: ComponentLoader;
  store: MediaStore;
  /** Resolve storage + limits per request — share this with the upload widgets. */
  resolveConfig: (req: Request) => Promise<ResolvedUploadConfig> | ResolvedUploadConfig;
  hardLimitBytes?: number;
  pageName?: string;
  label?: string;
  icon?: string;
  /** Access predicate. Default: any admin or super admin. */
  canAccess?: (admin: any) => boolean;
}

export interface MediaFieldOptions {
  properties: string[] | Record<string, { multiple?: boolean }>;
  /** Default `multiple` for every listed property. */
  multiple?: boolean;
}

export interface MediaFeature {
  pages: Record<string, { label: string; icon: string; component: string; handler: PageHandler }>;
  router: Router;
  /** AdminJS feature that turns properties into Media Library pickers. */
  field: (options: MediaFieldOptions) => (resourceOptions: Record<string, any>) => Record<string, any>;
}

let pageComponent: string | null = null;
let fieldComponent: string | null = null;

export const createMediaFeature = (options: CreateMediaFeatureOptions): MediaFeature => {
  const {
    componentLoader,
    store,
    resolveConfig,
    hardLimitBytes = 25 * 1024 * 1024,
    pageName = 'media',
    label = 'Media Library',
    icon = 'Image',
    canAccess = (admin: any) => admin?.isAdmin === true || admin?.isSuperAdmin === true,
  } = options;

  if (!pageComponent) {
    pageComponent = componentLoader.add('AdminjsUiMediaLibrary', '../components/media-library.tsx');
  }
  if (!fieldComponent) {
    fieldComponent = componentLoader.add('AdminjsUiMediaField', '../components/media-field.tsx');
  }

  const guard = (req: Request, res: any, next: any): void => {
    if (canAccess((req as any).session?.adminUser ?? null)) {
      next();
      return;
    }
    res.status(403).json({ error: 'Not allowed.' });
  };

  // --- JSON API -----------------------------------------------------------
  const api = Router();
  api.use(express.json({ limit: '2mb' }), guard);

  api.get('/', async (req, res) => {
    try {
      const result = await store.list({
        search: typeof req.query.search === 'string' ? req.query.search : undefined,
        kind: (req.query.kind as MediaKind | 'all' | undefined) ?? 'all',
        page: Number(req.query.page) || 1,
        pageSize: Number(req.query.pageSize) || undefined,
      });
      res.json(result);
    } catch (error) {
      console.error('[adminjs-ui] media list failed', error);
      res.status(500).json({ error: 'Unable to load media.' });
    }
  });

  api.get('/:id', async (req, res) => {
    const item = await store.get(req.params.id);
    if (!item) {
      res.status(404).json({ error: 'Not found.' });
      return;
    }
    res.json(item);
  });

  api.patch('/:id', async (req, res) => {
    const body = (req.body as { alt?: unknown; title?: unknown }) ?? {};
    const patch: { alt?: string | null; title?: string | null } = {};
    if (body.alt !== undefined) patch.alt = body.alt === null ? null : String(body.alt).slice(0, 500);
    if (body.title !== undefined) patch.title = body.title === null ? null : String(body.title).slice(0, 300);
    const item = await store.update(req.params.id, patch);
    if (!item) {
      res.status(404).json({ error: 'Not found.' });
      return;
    }
    res.json(item);
  });

  api.delete('/:id', async (req, res) => {
    try {
      const removed = await store.remove(req.params.id);
      if (removed?.storageKey) {
        try {
          const { storage } = await resolveConfig(req);
          await storage.delete(removed.storageKey);
        } catch {
          /* storage cleanup is best-effort */
        }
      }
      res.status(204).end();
    } catch (error) {
      console.error('[adminjs-ui] media delete failed', error);
      res.status(500).json({ error: 'Unable to delete.' });
    }
  });

  // --- Upload (registers every file in the library) ----------------------
  const uploadRouter = createUploadRouter({
    resolveConfig,
    hardLimitBytes,
    onStored: async (stored, req) => {
      const item = await store.create({
        url: stored.url,
        storageKey: stored.key,
        name: stored.name,
        mime: stored.mime,
        size: stored.size,
        width: stored.width ?? null,
        height: stored.height ?? null,
        createdByEmail: (req as any).session?.adminUser?.email ?? null,
      });
      return { id: item.id, alt: item.alt, title: item.title, createdAt: item.createdAt };
    },
  });

  const router = Router();
  router.use(MEDIA_API_PATH, api);
  router.use(MEDIA_UPLOAD_PATH, adminSessionGuard(), guard, uploadRouter);

  // --- AdminJS page -----------------------------------------------------
  const handler: PageHandler = async (_request, _response, context) => {
    if (!canAccess((context as any)?.currentAdmin ?? null)) {
      return { forbidden: true };
    }
    return { forbidden: false };
  };

  // --- Field feature --------------------------------------------------
  const field = (fieldOptions: MediaFieldOptions) => {
    const names = Array.isArray(fieldOptions.properties)
      ? fieldOptions.properties
      : Object.keys(fieldOptions.properties);
    const perField: Record<string, { multiple?: boolean }> = Array.isArray(fieldOptions.properties)
      ? {}
      : fieldOptions.properties;

    return (resourceOptions: Record<string, any> = {}): Record<string, any> => {
      const properties = { ...(resourceOptions.properties ?? {}) };
      for (const name of names) {
        const multiple = perField[name]?.multiple ?? fieldOptions.multiple ?? false;
        properties[name] = {
          ...(properties[name] ?? {}),
          type: 'string',
          components: {
            ...(properties[name]?.components ?? {}),
            edit: fieldComponent,
            show: fieldComponent,
            list: fieldComponent,
          },
          custom: { ...(properties[name]?.custom ?? {}), multiple },
        };
      }
      return { ...resourceOptions, properties };
    };
  };

  return {
    pages: { [pageName]: { label, icon, component: pageComponent, handler } },
    router,
    field,
  };
};
