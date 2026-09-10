# @yitanz/adminjs-ui — install guide (clean AdminJS)

This is the full walkthrough for adding the library to a **vanilla AdminJS 7 +
Express + TypeORM** app. End result: a **Settings** page (branding + upload
backend, applied without a restart), a **Media Library** page (WordPress-style
grid + modal picker), a shared upload endpoint, and image-picker fields.

---

## 0. Requirements

Your app already has:

| Package | Why |
| --- | --- |
| `adminjs` (v7) + `@adminjs/express` | the panel + its authenticated router |
| `@adminjs/typeorm` + `typeorm` | resources + a `DataSource` |
| `express` + `express-session` | the HTTP app and a session (the library's routes read `req.session.adminUser`) |
| `react`, `react-dom`, `styled-components`, `@adminjs/design-system` | AdminJS's own front-end stack (peer deps) |

---

## 1. Get the code

**This package is not on npm yet.** It is developed inside the CMS repo at
`product/cms/src/adminjs-ui/`. Until it is extracted and published:

1. **Copy** the whole `src/adminjs-ui/` folder into your project (e.g. to
   `src/adminjs-ui/`). Take `README.md` / `INSTALL.md` / `tests/` too if you
   want them.
2. **Install the runtime deps** it needs (these would normally come with the
   npm package):

   ```bash
   npm install react-dropzone@^14 react-image-crop@^11 image-size@^1
   ```

3. **Import it by relative path.** Everywhere the examples below say
   `from '@yitanz/adminjs-ui'`, use your path instead, e.g.:

   ```ts
   import { installAdminJsUi } from './adminjs-ui/index.js';
   ```

   Or add a tsconfig alias so the examples work verbatim:

   ```jsonc
   // tsconfig.json
   "paths": { "@yitanz/adminjs-ui": ["./src/adminjs-ui/index.ts"] }
   ```

Once it lives in its own published package this whole step becomes
`npm install @yitanz/adminjs-ui`. The folder already ships a `package.json`,
`tsconfig.build.json` and `LICENSE` — see **[PUBLISHING.md](./PUBLISHING.md)** to
extract and publish it.

---

## 2. One setup file

Create **`src/admin-ui.ts`** — the only place your app configures the library:

```ts
import { installAdminJsUi } from '@yitanz/adminjs-ui';

import componentLoader from './component-loader.js';   // your AdminJS ComponentLoader
import { AppDataSource } from './data-source.js';

export const adminUi = installAdminJsUi({
  componentLoader,
  dataSource: AppDataSource,

  // Branding shown until an admin changes it on the Settings page.
  settings: {
    brandingDefaults: {
      companyName: 'My CMS',
      logo: '/admin/assets/logo.png',
      favicon: '/admin/assets/favicon.png',
      primaryColor: '#4268f6',
      accentColor: '#1c1c1c',
    },
    // static bits of AdminJS `branding.theme` you keep fixed
    extendBranding: { theme: { fonts: { base: 'Inter, system-ui, sans-serif' } } },
  },

  media: {},   // enable the Media Library with defaults

  // Upload backend. Omit `localDisk` to keep everything inline as base64.
  upload: {
    localDisk: { directory: '/var/app/uploads', publicPath: '/admin/uploads' },
  },
});
```

> **Import order matters:** this file registers the library's page components on
> your `componentLoader`, so it must be imported **before** you construct
> `new AdminJS(...)`.

---

## 3. Three hookups

### 3a. DataSource — add the library's tables

```ts
// data-source.ts
import { adminUi } from './admin-ui.js';   // or: import { ADMINJS_UI_ENTITIES } from '@yitanz/adminjs-ui'

export const AppDataSource = new DataSource({
  // ...
  entities: [...myEntities, ...adminUi.entities],
  synchronize: true,   // or run a migration — the two tables are plain key/value + media rows
});
```

If importing `adminUi` here causes a circular import, use the standalone export
instead:

```ts
import { ADMINJS_UI_ENTITIES } from '@yitanz/adminjs-ui';
entities: [...myEntities, ...ADMINJS_UI_ENTITIES],
```

### 3b. AdminJS options — wrap them

```ts
// admin/options.ts
import { adminUi } from '../admin-ui.js';

export const adminJsOptions = adminUi.applyOptions({
  rootPath: '/admin',
  componentLoader,
  resources: [ /* your resources */ ],
  pages: { /* your pages */ },
});
```

`applyOptions` merges in the `settings` + `media` pages, sets `branding` to a
per-request function (only if you didn't set your own `branding`), and removes
any resource that was auto-generated for the library's own entities.

### 3c. Express — mount everything

```ts
// index.ts
import express from 'express';
import session from 'express-session';
import AdminJS from 'adminjs';
import AdminJSExpress from '@adminjs/express';

import { adminUi } from './admin-ui.js';
import { adminJsOptions } from './admin/options.js';

const app = express();
app.use(session({ secret: process.env.SESSION_SECRET!, resave: false, saveUninitialized: false }));

const admin = new AdminJS(adminJsOptions);
await admin.watch();               // or admin.initialize() in production

const adminRouter = AdminJSExpress.buildAuthenticatedRouter(
  admin,
  { cookiePassword: process.env.SESSION_SECRET!, authenticate },
  null,
  { resave: false, saveUninitialized: false, secret: process.env.SESSION_SECRET! },
);
app.use(admin.options.rootPath, adminRouter);

// 👇 the library's routes: settings API, media API, upload endpoint, static host
adminUi.mount(app, { rootPath: admin.options.rootPath });

app.listen(3000);
```

`mount` must run on the **same app** that has `express-session` and the AdminJS
authenticated router, so the routes can read the logged-in admin from the
session. Order relative to `adminRouter` doesn't matter.

That's the whole integration. Start the app and log in — **Media Library** and
**Settings** now appear in the sidebar.

---

## 4. Use the Media Library picker on a resource

```ts
import { adminUi } from '../admin-ui.js';

const PostResource = {
  resource: Post,
  options: { /* ... */ },
  features: [
    adminUi.mediaField({
      properties: {
        cover: { multiple: false },   // stores one URL string
        gallery: { multiple: true },  // stores a JSON array of URL strings
      },
    }),
  ],
};
```

Back the columns with text:

```ts
@Column({ type: 'text', nullable: true })  cover!: string | null;
@Column({ type: 'text', nullable: true })  gallery!: string | null;
```

The field opens the Media Library modal: browse/search existing media or upload
new — every upload is registered in the library.

---

## 5. Storage backends

`installAdminJsUi({ upload })` decides where dropped files go. The **Settings
page** lets an admin switch between `base64` and `localDisk` at runtime.

| Backend | Config |
| --- | --- |
| Inline base64 (default) | nothing — always available |
| Local disk | `upload: { localDisk: { directory, publicPath } }` — `mount` serves `publicPath` statically |
| Anything else (S3, …) | `upload: { storageFor: (kind) => myAdapter }` — return a `StorageAdapter` (`save`, `delete`) |

---

## 6. What you get

**Tables** (created by `synchronize`): `adminjs_ui_settings`, `adminjs_ui_media`.

**Pages**: `/{rootPath}/pages/settings` (super admins), `/{rootPath}/pages/media`
(admins). Rename with `settings.pageName` / `media.pageName`.

**Routes** (mounted by `adminUi.mount`):

| Method | Path | Purpose |
| --- | --- | --- |
| GET / POST | `/adminjs-ui/api/settings` | load / save settings |
| GET | `/adminjs-ui/api/media` | list (search, kind, page) |
| GET / PATCH / DELETE | `/adminjs-ui/api/media/:id` | one item |
| POST | `/adminjs-ui/media/upload` | upload + register in the library |
| POST / DELETE | `/admin/adminjs-ui/upload` | generic upload (field widgets); path configurable via `upload.path` |
| GET | `<publicPath>/*` | static host, only when `upload.localDisk` is set |

---

## 7. Turning parts off

```ts
installAdminJsUi({
  componentLoader, dataSource,
  settings: false,   // no Settings page, no dynamic branding
  media: false,      // no Media Library page/field
});
```

With `settings: false` you keep your own `branding` in AdminJS options and the
upload endpoint falls back to `upload.accept` / `upload.maxFileSizeBytes`.

---

## 8. Custom sidebar

On a **default** AdminJS sidebar the two pages show up automatically. If you
**override `SidebarResourceSection`** yourself, append the links:

```tsx
import { adminJsUiNavLinks } from '@yitanz/adminjs-ui';

const links = adminJsUiNavLinks({ currentAdmin, location, navigate });   // role-gated
return <Navigation elements={[...yourElements, ...links]} />;
```

---

## 9. À la carte (without `installAdminJsUi`)

Every piece is exported on its own:

- `createSettingsFeature({ componentLoader, store, storageFor })` → `{ pages, router, resolveBranding, resolveUploadConfig }`
- `createMediaFeature({ componentLoader, store, resolveConfig })` → `{ pages, router, field }`
- `multiFileUploadFeature({ componentLoader, properties })` — multi-file field, value = JSON `StoredFile[]`; `library: true` adds a "Choose from library" button
- `singleImageFeature({ componentLoader, properties })` — one-image field, value = URL string; `library: true` adds a "Choose from library" button
- `SingleImageInput` — the raw one-image React component for custom pages
- `createUploadRouter({ resolveConfig | storage, onStored? })` — the upload endpoint
- Stores: `typeormSettingsStore`, `jsonFileSettingsStore`, `memorySettingsStore`, `typeormMediaStore`, `memoryMediaStore`
- Storage adapters: `base64StorageAdapter`, `localDiskStorageAdapter`, `s3StorageAdapter`

---

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| Pages/components missing from the bundle | `admin-ui.ts` imported **after** `new AdminJS(...)` — import it first |
| `/adminjs-ui/api/*` returns `403 Not allowed` | not logged in, or `req.session.adminUser` not set — `mount` must be on the app that has `express-session` + the AdminJS auth router |
| `"localDisk" upload backend is selected but not configured` | admin picked Local disk on the Settings page but you didn't pass `upload.localDisk` |
| Library entities show up as AdminJS resources | you built resources before calling `adminUi.applyOptions` and didn't pass them through it |
| Uploaded images 404 | `upload.localDisk.publicPath` not served — `adminUi.mount` handles it; make sure it runs |
