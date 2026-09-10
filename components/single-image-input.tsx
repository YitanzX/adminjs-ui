import React from 'react';
import { useDropzone } from 'react-dropzone';
import styled from '@adminjs/design-system/styled-components';
import { Box, Button, Label } from '@adminjs/design-system';

import {
  DEFAULT_ACCEPT,
  DEFAULT_MAX_FILE_SIZE_BYTES,
  DEFAULT_UPLOAD_PATH,
  formatBytes,
  isAcceptedMime,
  type CropConfig,
} from '../shared.js';
import { deleteStored, uploadBlob } from './uploader.js';
import { CropModal } from './crop-modal.js';

const Frame = styled.div<{ $active: boolean; $disabled: boolean }>`
  display: flex;
  gap: 14px;
  align-items: flex-start;
  border: 2px dashed
    ${({ $active, theme }) => ($active ? theme?.colors?.primary100 ?? '#4268f6' : theme?.colors?.border ?? '#c0c4ce')};
  border-radius: 8px;
  padding: 14px;
  background: ${({ $active, theme }) => ($active ? theme?.colors?.primary20 ?? '#eef2ff' : theme?.colors?.white ?? '#fff')};
  opacity: ${({ $disabled }) => ($disabled ? 0.6 : 1)};
`;

const Preview = styled.div<{ $src: string }>`
  width: 104px;
  height: 104px;
  flex: 0 0 auto;
  border-radius: 6px;
  border: 1px solid ${({ theme }) => theme?.colors?.border ?? '#e0e2e8'};
  background: ${({ theme }) => theme?.colors?.grey20 ?? '#f6f7f9'} url(${({ $src }) => $src}) center / cover no-repeat;
`;

const Body = styled.div`
  flex: 1 1 auto;
  min-width: 0;
  font-size: 12px;
  color: ${({ theme }) => theme?.colors?.grey60 ?? '#6b7280'};
`;

const Row = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 8px;
`;

const ErrorText = styled.div`
  margin-top: 6px;
  color: ${({ theme }) => theme?.colors?.error ?? '#c92a2a'};
`;

const toDropzoneAccept = (list: string[]): Record<string, string[]> | undefined => {
  const out: Record<string, string[]> = {};
  for (const entry of list) out[entry.endsWith('/') ? `${entry}*` : entry] = [];
  return Object.keys(out).length ? out : undefined;
};

export interface SingleImageInputProps {
  value: string;
  onChange: (url: string) => void;
  uploadPath?: string;
  deletePath?: string;
  accept?: string[];
  maxFileSizeBytes?: number;
  crop?: CropConfig | false;
  disabled?: boolean;
  label?: string;
  hint?: string;
}

/**
 * Standalone one-image picker: drop / browse a single file, optionally crop it,
 * upload with a progress indicator, and hand the resulting URL back through
 * `onChange`. Not tied to AdminJS property machinery, so it works inside custom
 * pages and plain forms.
 */
export const SingleImageInput: React.FC<SingleImageInputProps> = ({
  value,
  onChange,
  uploadPath = DEFAULT_UPLOAD_PATH,
  deletePath,
  accept = DEFAULT_ACCEPT,
  maxFileSizeBytes = DEFAULT_MAX_FILE_SIZE_BYTES,
  crop = {},
  disabled = false,
  label,
  hint,
}) => {
  const [progress, setProgress] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [pendingSrc, setPendingSrc] = React.useState<string | null>(null);
  const lastKeyRef = React.useRef<string | null>(null);
  const pendingFileRef = React.useRef<File | null>(null);

  const send = (blob: Blob, name: string): void => {
    setError(null);
    setProgress(0);
    uploadBlob(uploadPath, blob, name, setProgress)
      .promise.then((stored) => {
        if (lastKeyRef.current && deletePath) deleteStored(deletePath, lastKeyRef.current);
        lastKeyRef.current = stored.key;
        onChange(stored.url);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => {
        setProgress(null);
        setPendingSrc((src) => {
          if (src) URL.revokeObjectURL(src);
          return null;
        });
      });
  };

  const onDrop = (files: File[]): void => {
    const file = files[0];
    if (!file) return;
    if (!isAcceptedMime(file.type, accept)) {
      setError('File type not allowed.');
      return;
    }
    if (file.size > maxFileSizeBytes) {
      setError(`File is larger than ${formatBytes(maxFileSizeBytes)}.`);
      return;
    }
    if (crop) {
      setPendingSrc(URL.createObjectURL(file));
      pendingFileRef.current = file;
      return;
    }
    send(file, file.name);
  };

  const dropzone = useDropzone({
    onDrop,
    accept: toDropzoneAccept(accept),
    maxSize: maxFileSizeBytes,
    multiple: false,
    disabled: disabled || progress !== null,
    noKeyboard: true,
  });

  const remove = (): void => {
    if (lastKeyRef.current && deletePath) deleteStored(deletePath, lastKeyRef.current);
    lastKeyRef.current = null;
    onChange('');
  };

  return (
    <Box marginBottom="lg">
      {label && <Label>{label}</Label>}
      <Frame {...dropzone.getRootProps()} $active={dropzone.isDragActive} $disabled={disabled}>
        <input {...dropzone.getInputProps()} />
        {value ? (
          <Preview $src={value} />
        ) : (
          <Preview $src="" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>
            no image
          </Preview>
        )}
        <Body>
          <div>
            <strong>Drop an image</strong> or click to browse
          </div>
          <div>
            {accept.join(', ')} · up to {formatBytes(maxFileSizeBytes)}
            {crop && crop.aspect ? ` · crop ${crop.aspect.toFixed(2)}:1` : ''}
          </div>
          {hint && <div style={{ marginTop: 4 }}>{hint}</div>}
          {progress !== null && <div style={{ marginTop: 6 }}>Uploading {Math.round(progress * 100)}%…</div>}
          {error && <ErrorText>{error}</ErrorText>}
          {value && !disabled && progress === null && (
            <Row>
              <Button
                type="button"
                size="sm"
                variant="light"
                onClick={(event) => {
                  event.stopPropagation();
                  dropzone.open();
                }}
              >
                Replace
              </Button>
              <Button
                type="button"
                size="sm"
                variant="danger"
                onClick={(event) => {
                  event.stopPropagation();
                  remove();
                }}
              >
                Remove
              </Button>
            </Row>
          )}
        </Body>
      </Frame>

      {pendingSrc && crop && (
        <CropModal
          src={pendingSrc}
          mime={pendingFileRef.current?.type ?? 'image/png'}
          fileName={pendingFileRef.current?.name ?? 'image'}
          config={crop}
          onCancel={() => {
            URL.revokeObjectURL(pendingSrc);
            setPendingSrc(null);
          }}
          onConfirm={(blob) => {
            URL.revokeObjectURL(pendingSrc);
            setPendingSrc(null);
            send(blob, pendingFileRef.current?.name ?? 'image');
          }}
        />
      )}
    </Box>
  );
};
