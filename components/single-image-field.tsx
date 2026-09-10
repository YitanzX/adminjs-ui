import React from 'react';
import { Box, Label } from '@adminjs/design-system';
import type { BasePropertyProps } from 'adminjs';

import { DEFAULT_ACCEPT, DEFAULT_MAX_FILE_SIZE_BYTES, DEFAULT_UPLOAD_PATH } from '../shared.js';
import { SingleImageInput } from './single-image-input.js';

/**
 * AdminJS property binding for `SingleImageInput`. Stores the plain image URL as
 * a string, so back it with a text column. Config comes from `property.custom`
 * (set by `singleImageFeature`).
 */
const SingleImageField: React.FC<BasePropertyProps> = (props) => {
  const { property, record, where } = props;
  const onChange = (props as { onChange?: (path: string, value: unknown) => void }).onChange;
  const custom = (property as { custom?: Record<string, any> }).custom ?? {};
  const value = String(record?.params?.[property.path] ?? '');

  if (!onChange || where === 'show' || where === 'list') {
    if (!value) return where === 'list' ? <span>—</span> : <Box>—</Box>;
    const img = (
      <img
        src={value}
        alt={String(property.label ?? '')}
        style={{ maxHeight: where === 'list' ? 40 : 120, maxWidth: '100%', borderRadius: 4, border: '1px solid #e0e2e8' }}
      />
    );
    return where === 'list' ? img : (
      <Box marginBottom="lg">
        <Label>{property.label}</Label>
        {img}
      </Box>
    );
  }

  return (
    <SingleImageInput
      label={String(property.label ?? property.path)}
      value={value}
      onChange={(url) => onChange(property.path, url)}
      uploadPath={custom.uploadPath ?? DEFAULT_UPLOAD_PATH}
      deletePath={custom.deletePath ?? custom.uploadPath ?? DEFAULT_UPLOAD_PATH}
      accept={custom.accept ?? DEFAULT_ACCEPT}
      maxFileSizeBytes={custom.maxFileSizeBytes ?? DEFAULT_MAX_FILE_SIZE_BYTES}
      crop={custom.crop ?? {}}
    />
  );
};

export default SingleImageField;
