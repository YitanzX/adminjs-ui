import React from 'react';
import { styled } from '@adminjs/design-system/styled-components';
import { Box, Button, Label } from '@adminjs/design-system';

import type { MediaItemDTO } from '../media/types.js';
import { MediaModal } from './media-modal.js';

const Strip = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 6px 0;
`;

const Thumb = styled.div<{ $src: string }>`
  position: relative;
  width: 84px;
  height: 84px;
  border-radius: 6px;
  border: 1px solid ${({ theme }) => theme?.colors?.border ?? '#e0e2e8'};
  background: ${({ theme }) => theme?.colors?.grey20 ?? '#f4f5f7'} url(${({ $src }) => $src}) center / cover no-repeat;
`;

const Remove = styled.button`
  position: absolute;
  top: -6px;
  right: -6px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: none;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  font-size: 12px;
  cursor: pointer;
`;

const urlsFrom = (value: string, multiple: boolean): string[] => {
  if (!value) return [];
  if (!multiple) return [value];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((entry) => typeof entry === 'string') : [];
  } catch {
    return value ? [value] : [];
  }
};

const serialize = (urls: string[], multiple: boolean): string =>
  multiple ? JSON.stringify(urls) : (urls[0] ?? '');

export interface MediaLibraryInputProps {
  value: string;
  onChange: (value: string) => void;
  multiple?: boolean;
  label?: string;
  disabled?: boolean;
}

export const MediaLibraryInput: React.FC<MediaLibraryInputProps> = ({
  value,
  onChange,
  multiple = false,
  label,
  disabled = false,
}) => {
  const [open, setOpen] = React.useState(false);
  const urls = urlsFrom(value, multiple);

  const confirm = (items: MediaItemDTO[]): void => {
    const picked = items.map((item) => item.url);
    onChange(serialize(multiple ? [...urls, ...picked.filter((u) => !urls.includes(u))] : picked, multiple));
    setOpen(false);
  };

  const removeAt = (index: number): void =>
    onChange(serialize(urls.filter((_, position) => position !== index), multiple));

  return (
    <Box marginBottom="lg">
      {label && <Label>{label}</Label>}
      {urls.length > 0 && (
        <Strip>
          {urls.map((url, index) => (
            <Thumb key={`${url}-${index}`} $src={url}>
              {!disabled && (
                <Remove type="button" title="Remove" onClick={() => removeAt(index)}>
                  ×
                </Remove>
              )}
            </Thumb>
          ))}
        </Strip>
      )}
      {!disabled && (
        <Button type="button" size="sm" variant="light" onClick={() => setOpen(true)}>
          {urls.length > 0 ? (multiple ? 'Add / change media' : 'Change media') : 'Select media'}
        </Button>
      )}
      {open && <MediaModal multiple={multiple} onClose={() => setOpen(false)} onConfirm={confirm} />}
    </Box>
  );
};
