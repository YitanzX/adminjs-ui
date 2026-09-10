import React from 'react';
import { useDropzone } from 'react-dropzone';
import styled from '@adminjs/design-system/styled-components';

import { MEDIA_UPLOAD_PATH, type MediaItemDTO } from '../media/types.js';
import { uploadBlob } from './uploader.js';

const Zone = styled.div<{ $active: boolean }>`
  border: 2px dashed ${({ $active, theme }) => ($active ? theme?.colors?.primary100 ?? '#4268f6' : theme?.colors?.border ?? '#c0c4ce')};
  border-radius: 8px;
  padding: 18px;
  text-align: center;
  font-size: 13px;
  color: ${({ theme }) => theme?.colors?.grey60 ?? '#5c6270'};
  background: ${({ $active, theme }) => ($active ? theme?.colors?.primary20 ?? '#eef2ff' : 'transparent')};
  cursor: pointer;
`;

const Rows = styled.div`
  margin-top: 10px;
  display: grid;
  gap: 6px;
`;

const RowLine = styled.div`
  font-size: 12px;
  display: flex;
  justify-content: space-between;
  gap: 12px;
`;

const Bar = styled.div`
  height: 4px;
  border-radius: 2px;
  background: ${({ theme }) => theme?.colors?.grey40 ?? '#e0e2e8'};
  overflow: hidden;
`;

const Fill = styled.div<{ $pct: number; $error: boolean }>`
  height: 100%;
  width: ${({ $pct }) => Math.round($pct * 100)}%;
  background: ${({ $error, theme }) => ($error ? theme?.colors?.error ?? '#c92a2a' : theme?.colors?.primary100 ?? '#4268f6')};
`;

interface Job {
  id: string;
  name: string;
  progress: number;
  error?: string;
}

export interface MediaUploaderProps {
  onUploaded: (item: MediaItemDTO) => void;
  accept?: string[];
  compact?: boolean;
}

const toAccept = (list?: string[]): Record<string, string[]> | undefined => {
  if (!list?.length) return undefined;
  const out: Record<string, string[]> = {};
  for (const entry of list) out[entry.endsWith('/') ? `${entry}*` : entry] = [];
  return out;
};

export const MediaUploader: React.FC<MediaUploaderProps> = ({ onUploaded, accept, compact }) => {
  const [jobs, setJobs] = React.useState<Job[]>([]);

  const patch = (id: string, next: Partial<Job>): void =>
    setJobs((current) => current.map((job) => (job.id === id ? { ...job, ...next } : job)));

  const onDrop = (files: File[]): void => {
    for (const file of files) {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setJobs((current) => [...current, { id, name: file.name, progress: 0 }]);
      uploadBlob(MEDIA_UPLOAD_PATH, file, file.name, (fraction) => patch(id, { progress: fraction }))
        .promise.then((stored) => {
          onUploaded(stored as unknown as MediaItemDTO);
          setJobs((current) => current.filter((job) => job.id !== id));
        })
        .catch((error: Error) => patch(id, { error: error.message, progress: 1 }));
    }
  };

  const dropzone = useDropzone({ onDrop, accept: toAccept(accept), noKeyboard: true });

  return (
    <div>
      <Zone {...dropzone.getRootProps()} $active={dropzone.isDragActive}>
        <input {...dropzone.getInputProps()} />
        {compact ? 'Drop files or click to upload' : (
          <>
            <strong>Drop files to upload</strong>
            <div>or click to pick from your computer</div>
          </>
        )}
      </Zone>
      {jobs.length > 0 && (
        <Rows>
          {jobs.map((job) => (
            <div key={job.id}>
              <RowLine>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.name}</span>
                <span>{job.error ? job.error : `${Math.round(job.progress * 100)}%`}</span>
              </RowLine>
              <Bar>
                <Fill $pct={job.progress} $error={!!job.error} />
              </Bar>
            </div>
          ))}
        </Rows>
      )}
      {!compact && (
        <div style={{ fontSize: 11, marginTop: 6, color: '#9aa0ab' }}>
          Uploaded files are added to the Media Library.
        </div>
      )}
    </div>
  );
};
