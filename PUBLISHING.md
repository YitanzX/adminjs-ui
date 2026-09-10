# Extracting & publishing `@yitanz/adminjs-ui`

This folder is already a self-contained package. To ship it to npm:

## 1. Move it out

```bash
git subtree split -P product/cms/src/adminjs-ui -b adminjs-ui   # or just copy the folder
mkdir ../adminjs-ui && git -C ../adminjs-ui init
# copy the folder contents to the new repo root
```

Everything the package needs is here: `package.json`, `tsconfig.build.json`,
`LICENSE`, `README.md`, `INSTALL.md`, all the source, and `tests/`.

## 2. Install & build

```bash
npm install          # pulls the deps + peer/dev deps
npm run build        # tsc -> dist/  +  copies components/ -> dist/components/
npm test             # 19 tests, no DB needed
```

`dist/` layout after build:

```
dist/
  index.js  index.d.ts        # the public entry
  install.js  entities.js
  feature/  settings/  media/  server/  storage/   # compiled server code
  components/*.tsx  components/*.ts                 # copied verbatim — AdminJS
                                                   # compiles these itself
```

The component files are **not** compiled by us: AdminJS's own bundler turns them
into the browser bundle at the consumer's build time, from the paths the feature
factories pass to `componentLoader.add('Name', '../components/x.tsx')`.

(`components/sidebar-links.ts` is the one exception — `index.ts` re-exports
`adminJsUiNavLinks` from it, so `tsc` also emits `dist/components/sidebar-links.js`.
The raw copy alongside it is inert; the compiled `.js` is what the barrel loads.)

## 3. Publish

```bash
npm publish --access public      # @yitanz scope must exist on npmjs.com
```

`prepublishOnly` runs the build automatically.

## 4. Consumers

`npm install @yitanz/adminjs-ui`, then follow `INSTALL.md` — the imports become
`from '@yitanz/adminjs-ui'` verbatim.

## Notes

- **ESM-only** (`"type": "module"`, `exports.import`). AdminJS 7 and modern
  Express apps are ESM; add a CJS build later if needed.
- **Peer deps**: `adminjs`, `@adminjs/design-system`, `react`, `react-dom`,
  `styled-components`, `express`, `typeorm`, `reflect-metadata`.
  `@aws-sdk/client-s3` is an optional peer (only for `s3StorageAdapter`).
- **Bundled deps**: `react-dropzone`, `react-image-crop`, `image-size`.
- The `build` script uses `node -e fs.cpSync` / `fs.rmSync` so it is
  cross-platform (no `rimraf` / `cp -R`).
- Add your own `eslint.config.mjs` in the extracted repo if you want linting;
  it was left out here to avoid interfering with the host CMS's lint run.
