# @yitanz/adminjs-ui

Customizable field widgets for **AdminJS 7** — a WordPress-style Media Library, a
self-contained visual Settings page, and drag-and-drop image/file upload fields.

Published on npm as [`@yitanz/adminjs-ui`](https://www.npmjs.com/package/@yitanz/adminjs-ui):

```bash
npm install @yitanz/adminjs-ui
```

The API is still pre-1.0 and may change between `0.1.x` releases.

## Install (one call)

Full step-by-step for a clean AdminJS app: **[INSTALL.md](./INSTALL.md)**.

`installAdminJsUi` wires the Settings page, the Media Library, the upload
endpoint and dynamic branding in one go. The host keeps **three mechanical
hookups** and no library logic of its own:

```ts
// admin/adminjs-ui.ts
import { installAdminJsUi } from '@yitanz/adminjs-ui';

export const ui = installAdminJsUi({
  componentLoader,
  dataSource: AppDataSource,
  settings: {
    brandingDefaults: { companyName: 'My CMS', logo: '/logo.png', primaryColor: '#f5b700', accentColor: '#c41c4f' },
    extendBranding: { theme: { fonts: { base: 'Inter, sans-serif' } } },   // static bits you keep fixed
  },
  media: {},
  upload: { localDisk: { directory: UPLOAD_DIR, publicPath: '/admin/uploads' } },
});
```

```ts
// 1. DataSource
entities: [...myEntities, ...ui.entities]

// 2. AdminJS options — augments pages, sets branding, strips the library's own auto-resources
return ui.applyOptions({ rootPath: '/admin', resources, pages: { ...myPages } });

// 3. express app
ui.mount(app);
```

Sidebar (only if you override `SidebarResourceSection` yourself): append
`adminJsUiNavLinks({ currentAdmin, location, navigate })`.

Disable a part with `settings: false` / `media: false`. Everything is also
usable piecemeal — see `createSettingsFeature`, `createMediaFeature`,
`multiFileUploadFeature`, `singleImageFeature` below.

## Layout

| Path | Runs in | Purpose |
| --- | --- | --- |
| `shared.ts` | both | Pure helpers + types (`StoredFile`, parse/serialize, mime/size checks). No node, no DOM. |
| `components/` | browser | React widgets. AdminJS bundles these itself from the paths registered by the feature factories. |
| `feature/` | server (boot) | AdminJS `FeatureType` factories. Register components + wire `properties`. |
| `server/` | server | Express upload router, request validation, session guard. |
| `storage/` | server | `StorageAdapter` interface + `base64`, `localDisk`, `s3` reference adapters. |
| `install.ts` | server | `installAdminJsUi` — the one-call wiring. |
| `entities.ts` | server | `ADMINJS_UI_ENTITIES` — TypeORM classes to spread into your DataSource. |
| `settings/` | both | Self-contained Settings page — schema (pure), pluggable `SettingsStore`, `createSettingsFeature`. |
| `media/` | both | WordPress-style Media Library — types (pure), pluggable `MediaStore`, `createMediaFeature`. |
| `tests/` | node | The library's own tests (`npm test` — 19 tests, no DB needed). |
| `index.ts` | server | Public entry point. |

The **only** distribution trick: AdminJS compiles component files from the
filesystem into its own browser bundle, so the feature factories pass **paths**
to `componentLoader.add()` (resolved to absolute via `component-path.ts`) — never
a direct import. That keeps `index.ts` node-safe.

## Multi-file upload + crop

Drag & drop, per-file preview, per-file progress bar, optional
crop-before-upload. The field value is a JSON string of `StoredFile[]` — back it
with a plain text column.

### 1. Mount the upload route (once)

```ts
import { adminSessionGuard, createUploadRouter, base64StorageAdapter } from '@yitanz/adminjs-ui';

app.use(
  '/admin/adminjs-ui/upload',
  adminSessionGuard(),                 // requires an authenticated AdminJS session
  createUploadRouter({ storage: base64StorageAdapter() }),
);
```

`installAdminJsUi` already mounts this route for you; do it by hand only when
wiring the pieces à la carte.

Storage options:

- `base64StorageAdapter()` — inline `data:` URI. Zero infra. Small files only.
- `localDiskStorageAdapter({ directory, publicPath })` — writes to disk; serve
  `publicPath` with `express.static(directory)`.
- `s3StorageAdapter({ client, bucket, publicBaseUrl })` — needs
  `@aws-sdk/client-s3` in the app; pass a ready `S3Client`.
- Or implement `StorageAdapter` (`save`, `delete`) yourself.

### 2. Add the feature to a resource

```ts
import componentLoader from './component-loader.js';
import { multiFileUploadFeature } from '@yitanz/adminjs-ui';

createResource(MyEntity, { /* options */ }, [
  multiFileUploadFeature({
    componentLoader,
    properties: {
      gallery: { crop: { aspect: 16 / 9 }, maxFiles: 6 },
    },
    maxFileSizeBytes: 5 * 1024 * 1024,
    accept: ['image/'],
  }),
]);
```

`properties` accepts either `['gallery', 'banners']` (shared defaults) or a
`{ name: overrides }` map. Overrides: `uploadPath`, `deletePath`, `accept`,
`maxFiles`, `maxFileSizeBytes`, `crop` (`{ aspect?, circular? }` or `false`),
`library`.

Set `library: true` (feature-wide or per property) to add a **Choose from
library** button beside the dropzone — it opens the Media Library picker so the
editor can reuse an existing file instead of uploading a new one. Needs
`createMediaFeature` mounted; picked files are referenced by URL and are never
deleted from storage by the field.

### 3. Entity column

```ts
@Column({ type: 'varchar', length: 'MAX', nullable: true })
gallery!: string | null;   // JSON array of StoredFile
```

Read it back with `parseFileList(row.gallery)`.

## Single-image picker

One image, value stored as a **plain URL string** (not JSON).

- **In a resource** — `singleImageFeature({ componentLoader, properties: ['logo'], crop: false })`.
  Add `library: true` for a **Choose from library** button (needs `createMediaFeature`).
- **In a custom AdminJS page** — import the raw component:

  ```tsx
  import { SingleImageInput } from '@yitanz/adminjs-ui/components/single-image-input.js';

  <SingleImageInput
    label="Logo"
    value={form.logo}
    onChange={(url) => setForm({ ...form, logo: url })}
    crop={false}
  />
  ```

  This is how the library's own Settings page does its branding images.

## Runtime-configurable uploads

`createUploadRouter` takes `resolveConfig(req)` instead of a static `storage`,
called per request to pick the storage adapter and enforce `accept` /
`maxFileSizeBytes`. `hardLimitBytes` caps the raw body parser independently.

## Settings page (`createSettingsFeature`)

A drop-in visual Settings page — branding (name, logo, favicon, primary/accent
colours) and the upload backend + limits — that needs **no app-specific
settings code**. Persistence is a pluggable `SettingsStore`.

```ts
import {
  createSettingsFeature,
  typeormSettingsStore,   // or jsonFileSettingsStore(path) / memorySettingsStore()
  AdminUiSetting,         // only for typeormSettingsStore — add to your DataSource `entities`
  localDiskStorageAdapter,
  base64StorageAdapter,
} from '@yitanz/adminjs-ui';

export const settings = createSettingsFeature({
  componentLoader,
  store: typeormSettingsStore(AppDataSource),
  brandingDefaults: { companyName: 'My CMS', logo: '/logo.png', primaryColor: '#f5b700', accentColor: '#c41c4f' },
  extendBranding: { theme: { fonts: { base: 'Inter, sans-serif' } } },  // static bits you keep fixed
  storageFor: (kind) =>
    kind === 'localDisk' ? localDiskStorageAdapter({ directory, publicPath }) : base64StorageAdapter(),
});
```

Then plug the three outputs in:

```ts
// AdminJS options
pages: { ...settings.pages },              // adds the "settings" page
branding: settings.resolveBranding,        // per-request, no restart

// express app
app.use(settings.router);                                    // owns /adminjs-ui/api/settings
app.use('/admin/adminjs-ui/upload', adminSessionGuard(),
  createUploadRouter({ resolveConfig: settings.resolveUploadConfig }));
```

Options: `pageName` / `label` / `icon`, `canAccess(admin)` (default: super admins
only), `uploadPath`, `library` (Choose-from-library button on the logo/favicon
pickers — defaults to `true` when the Media Library is installed via
`installAdminJsUi`), `brandingDefaults`, `uploadDefaults`. Surfacing the page in
a custom sidebar is the host's job (an AdminJS page lives at
`/<rootPath>/pages/<pageName>`).

## Media Library (`createMediaFeature`) — WordPress-style

A browsable grid **page** (search, type filter, drag-drop upload, detail sidebar
with alt/title + copy-URL + delete, multi-select bulk delete) **plus a modal
picker field** (`Set featured image`-style). Every upload — from the page, the
modal, or any `multiFileUploadFeature` field pointed at the same route — is
registered as a `MediaItem`. Persistence is a pluggable `MediaStore`.

```ts
import {
  createMediaFeature, typeormMediaStore, MediaItem,   // add MediaItem to your DataSource entities
} from '@yitanz/adminjs-ui';

export const media = createMediaFeature({
  componentLoader,
  store: typeormMediaStore(AppDataSource),
  resolveConfig: settings.resolveUploadConfig,   // share storage + limits with Settings
});
```

```ts
// AdminJS options
pages: { ...media.pages },          // adds the "media" page

// express app
app.use(media.router);             // owns /adminjs-ui/api/media + /adminjs-ui/media/upload

// any resource — pick from / upload to the library
createResource(Post, { /* ... */ }, [
  media.field({ properties: { cover: { multiple: false }, gallery: { multiple: true } } }),
]);
```

Field value is a plain image URL (single) or a JSON array of URLs (multiple) —
back it with a text column. `MediaStore` (`list`, `get`, `create`, `update`,
`remove`) can wrap any backend; `memoryMediaStore` ships for tests.

Roadmap for the library page: in-place crop/rotate, folders, list view.

## Roadmap

- Rich text (TipTap) with inline image upload — reuses the storage adapters.
- Async select (react-select) with remote search.
- Location picker (Leaflet + OSM tiles), pluggable providers.
