import React from 'react';
import { useDropzone } from 'react-dropzone';
import { styled } from '@adminjs/design-system/styled-components';
import { Box, Button, Label } from '@adminjs/design-system';
import type { BasePropertyProps } from 'adminjs';

import {
  DEFAULT_ACCEPT,
  DEFAULT_MAX_FILES,
  DEFAULT_MAX_FILE_SIZE_BYTES,
  DEFAULT_UPLOAD_PATH,
  formatBytes,
  isAcceptedMime,
  parseFileList,
  serializeFileList,
  type CropConfig,
  type StoredFile,
} from '../shared.js';
import type { MediaItemDTO } from '../media/types.js';
import { deleteStored, uploadBlob, type UploadHandle } from './uploader.js';
import { CropModal } from './crop-modal.js';
import { MediaModal } from './media-modal.js';

interface PendingItem {
  id: string;
  name: string;
  mime: string;
  blob: Blob;
  previewUrl: string;
  progress: number;
  status: 'ready' | 'uploading' | 'error';
  error?: string;
  handle?: UploadHandle;
}

const Dropzone = styled.div<{ $active: boolean; $disabled: boolean }>`
  border: 2px dashed ${({ $active, theme }) => ($active ? theme?.colors?.primary100 ?? '#4268f6' : theme?.colors?.border ?? '#c0c4ce')};
  border-radius: 8px;
  padding: 22px 16px;
  text-align: center;
  color: ${({ theme }) => theme?.colors?.grey60 ?? '#5c6270'};
  background: ${({ $active, theme }) => ($active ? theme?.colors?.primary20 ?? '#eef2ff' : theme?.colors?.white ?? '#fff')};
  cursor: ${({ $disabled }) => ($disabled ? 'not-allowed' : 'pointer')};
  opacity: ${({ $disabled }) => ($disabled ? 0.6 : 1)};
  transition: border-color 0.15s ease, background 0.15s ease;
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(132px, 1fr));
  gap: 12px;
  margin-top: 12px;
`;

const Card = styled.div`
  position: relative;
  border: 1px solid ${({ theme }) => theme?.colors?.border ?? '#e0e2e8'};
  border-radius: 8px;
  overflow: hidden;
  background: ${({ theme }) => theme?.colors?.grey20 ?? '#f6f7f9'};
`;

const Thumb = styled.div<{ $src: string }>`
  width: 100%;
  aspect-ratio: 1 / 1;
  background-image: url(${({ $src }) => $src});
  background-size: cover;
  background-position: center;
`;

const Meta = styled.div`
  padding: 6px 8px;
  font-size: 11px;
  line-height: 1.35;
  color: ${({ theme }) => theme?.colors?.grey80 ?? '#3b3f4a'};
  word-break: break-word;
`;

const IconButton = styled.button`
  position: absolute;
  top: 6px;
  right: 6px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: none;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  font-size: 13px;
  line-height: 22px;
  cursor: pointer;
`;

const CropButton = styled.button`
  position: absolute;
  bottom: 34px;
  left: 6px;
  padding: 2px 8px;
  border-radius: 4px;
  border: none;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  font-size: 11px;
  cursor: pointer;
`;

const Bar = styled.div`
  height: 4px;
  background: ${({ theme }) => theme?.colors?.grey40 ?? '#dfe1e6'};
`;

const Fill = styled.div<{ $pct: number; $error: boolean }>`
  height: 100%;
  width: ${({ $pct }) => Math.round($pct * 100)}%;
  background: ${({ $error, theme }) => ($error ? theme?.colors?.error ?? '#c92a2a' : theme?.colors?.primary100 ?? '#4268f6')};
  transition: width 0.2s ease;
`;

const Hint = styled.div`
  margin-top: 8px;
  font-size: 12px;
  color: ${({ theme }) => theme?.colors?.grey60 ?? '#6b7280'};
`;

const ErrorText = styled(Hint)`
  color: ${({ theme }) => theme?.colors?.error ?? '#c92a2a'};
`;

const toDropzoneAccept = (list: string[]): Record<string, string[]> | undefined => {
  const out: Record<string, string[]> = {};
  for (const entry of list) out[entry.endsWith('/') ? `${entry}*` : entry] = [];
  return Object.keys(out).length ? out : undefined;
};

const uid = (): string => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const MultiFileUpload: React.FC<BasePropertyProps> = (props) => {
  const { property, record } = props;
  const onChange = (props as { onChange?: (path: string, value: unknown) => void }).onChange;
  const custom = (property as { custom?: Record<string, any> }).custom ?? {};

  const uploadPath: string = custom.uploadPath ?? DEFAULT_UPLOAD_PATH;
  const deletePath: string = custom.deletePath ?? uploadPath;
  const accept: string[] = custom.accept ?? DEFAULT_ACCEPT;
  const maxFiles: number = custom.maxFiles ?? DEFAULT_MAX_FILES;
  const maxFileSizeBytes: number = custom.maxFileSizeBytes ?? DEFAULT_MAX_FILE_SIZE_BYTES;
  const cropConfig: CropConfig | false = custom.crop ?? {};
  const library: boolean = !!custom.library;

  const [value, setValue] = React.useState<StoredFile[]>(() =>
    parseFileList(record?.params?.[property.path]),
  );
  const [pending, setPending] = React.useState<PendingItem[]>([]);
  const [cropId, setCropId] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = React.useState(false);

  const pendingRef = React.useRef(pending);
  pendingRef.current = pending;
  React.useEffect(
    () => () => pendingRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl)),
    [],
  );

  const emit = (next: StoredFile[]): void => {
    setValue(next);
    onChange?.(property.path, serializeFileList(next));
  };

  const slotsLeft = (): number => maxFiles - value.length - pending.length;

  const onDrop = (files: File[]): void => {
    const room = slotsLeft();
    if (room <= 0) {
      setNotice(`You can attach at most ${maxFiles} file(s).`);
      return;
    }
    const next: PendingItem[] = [];
    const rejected: string[] = [];
    for (const file of files.slice(0, room)) {
      if (!isAcceptedMime(file.type, accept)) {
        rejected.push(`${file.name}: type not allowed`);
        continue;
      }
      if (file.size > maxFileSizeBytes) {
        rejected.push(`${file.name}: larger than ${formatBytes(maxFileSizeBytes)}`);
        continue;
      }
      next.push({
        id: uid(),
        name: file.name,
        mime: file.type || 'application/octet-stream',
        blob: file,
        previewUrl: URL.createObjectURL(file),
        progress: 0,
        status: 'ready',
      });
    }
    if (files.length > room) rejected.push(`${files.length - room} file(s) over the ${maxFiles} limit`);
    setNotice(rejected.length ? rejected.join(' · ') : null);
    if (next.length) setPending((current) => [...current, ...next]);
  };

  const dropzone = useDropzone({
    onDrop,
    accept: toDropzoneAccept(accept),
    maxSize: maxFileSizeBytes,
    disabled: !onChange || slotsLeft() <= 0,
    noKeyboard: true,
  });

  const patchPending = (id: string, patch: Partial<PendingItem>): void =>
    setPending((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));

  const removePending = (id: string): void =>
    setPending((current) => {
      const target = current.find((item) => item.id === id);
      if (target) {
        target.handle?.abort();
        URL.revokeObjectURL(target.previewUrl);
      }
      return current.filter((item) => item.id !== id);
    });

  const applyCrop = (blob: Blob): void => {
    setPending((current) =>
      current.map((item) => {
        if (item.id !== cropId) return item;
        URL.revokeObjectURL(item.previewUrl);
        return { ...item, blob, previewUrl: URL.createObjectURL(blob), status: 'ready', error: undefined };
      }),
    );
    setCropId(null);
  };

  const uploadItem = (item: PendingItem): Promise<void> => {
    const handle = uploadBlob(uploadPath, item.blob, item.name, (fraction) =>
      patchPending(item.id, { progress: fraction }),
    );
    patchPending(item.id, { status: 'uploading', progress: 0, error: undefined, handle });
    return handle.promise
      .then((stored) => {
        URL.revokeObjectURL(item.previewUrl);
        setPending((current) => current.filter((entry) => entry.id !== item.id));
        setValue((current) => {
          const next = [...current, stored];
          onChange?.(property.path, serializeFileList(next));
          return next;
        });
      })
      .catch((error: Error) => {
        patchPending(item.id, { status: 'error', error: error.message });
      });
  };

  const uploadAll = (): void => {
    pending.filter((item) => item.status === 'ready' || item.status === 'error').forEach(uploadItem);
  };

  const removeStored = (index: number): void => {
    const removed = value[index];
    emit(value.filter((_, position) => position !== index));
    if (removed?.key) deleteStored(deletePath, removed.key);
  };

  const addFromLibrary = (items: MediaItemDTO[]): void => {
    setPickerOpen(false);
    const room = slotsLeft();
    if (room <= 0) {
      setNotice(`You can attach at most ${maxFiles} file(s).`);
      return;
    }
    const additions: StoredFile[] = items
      .filter((item) => !value.some((file) => file.url === item.url))
      .slice(0, room)
      .map((item) => ({
        url: item.url,
        // Empty key: the file belongs to the library, so this field never deletes it.
        key: '',
        name: item.name,
        size: item.size,
        mime: item.mime,
        width: item.width ?? undefined,
        height: item.height ?? undefined,
      }));
    if (!additions.length) {
      setNotice(null);
      return;
    }
    emit([...value, ...additions]);
    setNotice(items.length > additions.length ? `Only ${additions.length} added — ${maxFiles} file limit.` : null);
  };

  const readOnly = !onChange;
  const cropTarget = pending.find((item) => item.id === cropId);
  const readyCount = pending.filter((item) => item.status === 'ready' || item.status === 'error').length;

  return (
    <Box marginBottom="lg">
      <Label>{property.label}</Label>

      {!readOnly && (
        <Dropzone
          {...dropzone.getRootProps()}
          $active={dropzone.isDragActive}
          $disabled={slotsLeft() <= 0}
        >
          <input {...dropzone.getInputProps()} />
          <div>
            <strong>Drop files here</strong> or click to browse
          </div>
          <div style={{ fontSize: 12, marginTop: 4 }}>
            {accept.join(', ')} · up to {formatBytes(maxFileSizeBytes)} · {value.length + pending.length}/{maxFiles}
          </div>
        </Dropzone>
      )}

      {!readOnly && library && (
        <Box marginTop="default">
          <Button
            type="button"
            size="sm"
            variant="light"
            disabled={slotsLeft() <= 0}
            onClick={() => setPickerOpen(true)}
          >
            Choose from library
          </Button>
        </Box>
      )}

      {notice && <ErrorText>{notice}</ErrorText>}

      {(value.length > 0 || pending.length > 0) && (
        <Grid>
          {value.map((file, index) => (
            <Card key={file.key || file.url}>
              <Thumb $src={file.url} />
              {!readOnly && (
                <IconButton type="button" title="Remove" onClick={() => removeStored(index)}>
                  ×
                </IconButton>
              )}
              <Meta>
                {file.name}
                <br />
                {formatBytes(file.size)}
              </Meta>
            </Card>
          ))}

          {pending.map((item) => (
            <Card key={item.id}>
              <Thumb $src={item.previewUrl} />
              <IconButton type="button" title="Remove" onClick={() => removePending(item.id)}>
                ×
              </IconButton>
              {cropConfig && item.status !== 'uploading' && (
                <CropButton type="button" onClick={() => setCropId(item.id)}>
                  Crop
                </CropButton>
              )}
              <Meta>
                {item.name}
                <br />
                {item.status === 'error' ? (
                  <span style={{ color: '#c92a2a' }}>{item.error}</span>
                ) : item.status === 'uploading' ? (
                  `Uploading ${Math.round(item.progress * 100)}%`
                ) : (
                  'Ready'
                )}
              </Meta>
              <Bar>
                <Fill $pct={item.status === 'uploading' ? item.progress : item.status === 'error' ? 1 : 0} $error={item.status === 'error'} />
              </Bar>
            </Card>
          ))}
        </Grid>
      )}

      {!readOnly && readyCount > 0 && (
        <Box marginTop="default">
          <Button type="button" variant="primary" onClick={uploadAll}>
            Upload {readyCount} file{readyCount > 1 ? 's' : ''}
          </Button>
          <Hint>Files are only saved to the record once uploaded.</Hint>
        </Box>
      )}

      {cropTarget && cropConfig && (
        <CropModal
          src={cropTarget.previewUrl}
          mime={cropTarget.mime}
          fileName={cropTarget.name}
          config={cropConfig}
          onCancel={() => setCropId(null)}
          onConfirm={applyCrop}
        />
      )}

      {pickerOpen && (
        <MediaModal multiple onClose={() => setPickerOpen(false)} onConfirm={addFromLibrary} />
      )}
    </Box>
  );
};

export default MultiFileUpload;
