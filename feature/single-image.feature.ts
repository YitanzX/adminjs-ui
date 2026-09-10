import type { ComponentLoader } from 'adminjs';

import { componentPath } from '../component-path.js';
import {
  DEFAULT_ACCEPT,
  DEFAULT_MAX_FILE_SIZE_BYTES,
  DEFAULT_UPLOAD_PATH,
  type CropConfig,
} from '../shared.js';

export interface SingleImageFieldOverride {
  uploadPath?: string;
  deletePath?: string;
  accept?: string[];
  maxFileSizeBytes?: number;
  crop?: CropConfig | false;
}

export interface SingleImageFeatureOptions {
  componentLoader: ComponentLoader;
  properties: string[] | Record<string, SingleImageFieldOverride>;
  uploadPath?: string;
  deletePath?: string;
  accept?: string[];
  maxFileSizeBytes?: number;
  crop?: CropConfig | false;
}

let registeredComponent: string | null = null;

const registerComponent = (componentLoader: ComponentLoader): string => {
  if (!registeredComponent) {
    registeredComponent = componentLoader.add(
      'AdminjsUiSingleImageField',
      componentPath('single-image-field.tsx'),
    );
  }
  return registeredComponent;
};

/**
 * AdminJS feature: renders the named properties as a one-image picker
 * (`SingleImageInput`). The value is the plain image URL as a string — back it
 * with a text column.
 */
export const singleImageFeature = (options: SingleImageFeatureOptions) => {
  const component = registerComponent(options.componentLoader);

  const names = Array.isArray(options.properties)
    ? options.properties
    : Object.keys(options.properties);
  const overrides: Record<string, SingleImageFieldOverride> = Array.isArray(options.properties)
    ? {}
    : options.properties;

  const base = {
    uploadPath: options.uploadPath ?? DEFAULT_UPLOAD_PATH,
    deletePath: options.deletePath ?? options.uploadPath ?? DEFAULT_UPLOAD_PATH,
    accept: options.accept ?? DEFAULT_ACCEPT,
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
          edit: component,
          show: component,
          list: component,
        },
        custom: {
          ...(properties[name]?.custom ?? {}),
          uploadPath: override.uploadPath ?? base.uploadPath,
          deletePath: override.deletePath ?? override.uploadPath ?? base.deletePath,
          accept: override.accept ?? base.accept,
          maxFileSizeBytes: override.maxFileSizeBytes ?? base.maxFileSizeBytes,
          crop: override.crop ?? base.crop,
        },
      };
    }

    return { ...resourceOptions, properties };
  };
};
