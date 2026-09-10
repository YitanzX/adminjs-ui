import type { ComponentLoader } from 'adminjs';

import {
  DEFAULT_ACCEPT,
  DEFAULT_MAX_FILES,
  DEFAULT_MAX_FILE_SIZE_BYTES,
  DEFAULT_UPLOAD_PATH,
  type CropConfig,
} from '../shared.js';

/** Per-property overrides. Anything omitted falls back to the feature defaults. */
export interface MultiFileFieldOverride {
  uploadPath?: string;
  deletePath?: string;
  accept?: string[];
  maxFiles?: number;
  maxFileSizeBytes?: number;
  crop?: CropConfig | false;
}

export interface MultiFileUploadFeatureOptions {
  /** The AdminJS `ComponentLoader` the panel is built with. */
  componentLoader: ComponentLoader;
  /**
   * Which resource properties become multi-file widgets. Either a list of names
   * (all sharing the feature defaults) or a map of name → overrides.
   */
  properties: string[] | Record<string, MultiFileFieldOverride>;
  /** Where `createUploadRouter` is mounted. Default `/admin/adminjs-ui/upload`. */
  uploadPath?: string;
  deletePath?: string;
  accept?: string[];
  maxFiles?: number;
  maxFileSizeBytes?: number;
  /** Crop-before-upload config, or `false` to disable cropping. Default `{}`. */
  crop?: CropConfig | false;
}

let registered: { edit: string; show: string } | null = null;

const registerComponents = (componentLoader: ComponentLoader): { edit: string; show: string } => {
  if (!registered) {
    registered = {
      edit: componentLoader.add('AdminjsUiMultiFileUpload', '../components/multi-file-upload.tsx'),
      show: componentLoader.add('AdminjsUiFilePreviewList', '../components/file-preview-list.tsx'),
    };
  }
  return registered;
};

/**
 * AdminJS feature that turns the named properties into drag-and-drop multi-file
 * uploaders with preview, per-file progress and crop-before-upload. The field
 * value is stored as a JSON string (`StoredFile[]`), so back it with a plain
 * text column.
 */
export const multiFileUploadFeature = (options: MultiFileUploadFeatureOptions) => {
  const components = registerComponents(options.componentLoader);

  const names = Array.isArray(options.properties)
    ? options.properties
    : Object.keys(options.properties);
  const overrides: Record<string, MultiFileFieldOverride> = Array.isArray(options.properties)
    ? {}
    : options.properties;

  const base = {
    uploadPath: options.uploadPath ?? DEFAULT_UPLOAD_PATH,
    deletePath: options.deletePath ?? options.uploadPath ?? DEFAULT_UPLOAD_PATH,
    accept: options.accept ?? DEFAULT_ACCEPT,
    maxFiles: options.maxFiles ?? DEFAULT_MAX_FILES,
    maxFileSizeBytes: options.maxFileSizeBytes ?? DEFAULT_MAX_FILE_SIZE_BYTES,
    crop: options.crop ?? {},
  };

  return (resourceOptions: Record<string, any> = {}): Record<string, any> => {
    const properties = { ...(resourceOptions.properties ?? {}) };

    for (const name of names) {
      const override = overrides[name] ?? {};
      properties[name] = {
        ...(properties[name] ?? {}),
        type: 'string',
        components: {
          ...(properties[name]?.components ?? {}),
          edit: components.edit,
          show: components.show,
          list: components.show,
        },
        custom: {
          ...(properties[name]?.custom ?? {}),
          uploadPath: override.uploadPath ?? base.uploadPath,
          deletePath: override.deletePath ?? override.uploadPath ?? base.deletePath,
          accept: override.accept ?? base.accept,
          maxFiles: override.maxFiles ?? base.maxFiles,
          maxFileSizeBytes: override.maxFileSizeBytes ?? base.maxFileSizeBytes,
          crop: override.crop ?? base.crop,
        },
      };
    }

    return { ...resourceOptions, properties };
  };
};
