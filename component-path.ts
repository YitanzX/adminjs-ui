import { fileURLToPath } from 'node:url';

/**
 * Absolute path to a file in the packaged `components/` directory.
 *
 * AdminJS's `ComponentLoader.add()` resolves a *relative* component path against
 * the caller's location as reported by the V8 stack trace. When the published
 * build ships source maps, that location is remapped to the original `.ts` file,
 * which sits one directory above the emitted `.js`, so a relative
 * `../components/x.tsx` resolves outside `dist/` and the bundle step fails to
 * find the file. `import.meta.url` is never rewritten by source maps, so an
 * absolute path derived from it resolves correctly in both the compiled package
 * (`dist/component-path.js` -> `dist/components/`) and when running the sources
 * directly (`component-path.ts` -> `components/`).
 */
export const componentPath = (file: string): string =>
  fileURLToPath(new URL(`./components/${file}`, import.meta.url));
