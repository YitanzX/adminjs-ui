import React from 'react';
import { Box, Label } from '@adminjs/design-system';
import type { BasePropertyProps } from 'adminjs';

import { MediaLibraryInput } from './media-library-input.js';

const readUrls = (raw: unknown, multiple: boolean): string[] => {
  const value = typeof raw === 'string' ? raw : '';
  if (!value) return [];
  if (!multiple) return [value];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((entry) => typeof entry === 'string') : [];
  } catch {
    return [value];
  }
};

/**
 * AdminJS property binding for the Media Library picker. Value is a plain URL
 * string (single) or a JSON array of URLs (multiple) — back it with a text
 * column. Config comes from `property.custom` (set by `media.field(...)`).
 */
const MediaField: React.FC<BasePropertyProps> = (props) => {
  const { property, record, where } = props;
  const onChange = (props as { onChange?: (path: string, value: unknown) => void }).onChange;
  const custom = (property as { custom?: Record<string, any> }).custom ?? {};
  const multiple = !!custom.multiple;
  const raw = record?.params?.[property.path];

  if (!onChange || where === 'show' || where === 'list') {
    const urls = readUrls(raw, multiple);
    if (urls.length === 0) return where === 'list' ? <span>—</span> : <Box>—</Box>;
    const thumbs = (
      <Box style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {urls.slice(0, where === 'list' ? 3 : urls.length).map((url, index) => (
          <img
            key={`${url}-${index}`}
            src={url}
            alt=""
            style={{
              height: where === 'list' ? 34 : 90,
              maxWidth: '100%',
              borderRadius: 4,
              border: '1px solid #e0e2e8',
              objectFit: 'cover',
            }}
          />
        ))}
      </Box>
    );
    return where === 'list' ? thumbs : (
      <Box marginBottom="lg">
        <Label>{property.label}</Label>
        {thumbs}
      </Box>
    );
  }

  return (
    <MediaLibraryInput
      label={String(property.label ?? property.path)}
      value={typeof raw === 'string' ? raw : ''}
      multiple={multiple}
      onChange={(value) => onChange(property.path, value)}
    />
  );
};

export default MediaField;
