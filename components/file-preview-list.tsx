import React from 'react';
import styled from 'styled-components';
import { Box, Label } from '@adminjs/design-system';
import type { BasePropertyProps } from 'adminjs';

import { formatBytes, parseFileList } from '../shared.js';

const Row = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
`;

const Thumb = styled.a<{ $src: string }>`
  display: block;
  width: 56px;
  height: 56px;
  border-radius: 6px;
  border: 1px solid ${({ theme }) => theme?.colors?.border ?? '#e0e2e8'};
  background-image: url(${({ $src }) => $src});
  background-size: cover;
  background-position: center;
`;

const More = styled.span`
  font-size: 12px;
  color: ${({ theme }) => theme?.colors?.grey60 ?? '#6b7280'};
`;

const FilePreviewList: React.FC<BasePropertyProps> = (props) => {
  const { property, record, where } = props;
  const files = parseFileList(record?.params?.[property.path]);

  if (files.length === 0) {
    return where === 'list' ? <span>—</span> : <Box>—</Box>;
  }

  const isList = where === 'list';
  const shown = isList ? files.slice(0, 3) : files;

  const content = (
    <Row>
      {shown.map((file) => (
        <Thumb
          key={file.key || file.url}
          href={file.url}
          target="_blank"
          rel="noreferrer"
          $src={file.url}
          title={`${file.name} · ${formatBytes(file.size)}`}
        />
      ))}
      {isList && files.length > shown.length && <More>+{files.length - shown.length}</More>}
    </Row>
  );

  if (isList) return content;

  return (
    <Box marginBottom="lg">
      <Label>{property.label}</Label>
      {content}
      <Box marginTop="sm" style={{ fontSize: 12, color: '#6b7280' }}>
        {files.length} file{files.length > 1 ? 's' : ''}
      </Box>
    </Box>
  );
};

export default FilePreviewList;
