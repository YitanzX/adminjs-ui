import React from 'react';
import styled from 'styled-components';

import { mediaKindOf, type MediaItemDTO } from '../media/types.js';

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(128px, 1fr));
  gap: 10px;
`;

const Tile = styled.button<{ $selected: boolean }>`
  position: relative;
  padding: 0;
  border: 2px solid ${({ $selected, theme }) => ($selected ? theme?.colors?.primary100 ?? '#4268f6' : 'transparent')};
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  background: ${({ theme }) => theme?.colors?.grey20 ?? '#f4f5f7'};
  aspect-ratio: 1 / 1;
  outline: 1px solid ${({ theme }) => theme?.colors?.border ?? '#e0e2e8'};
`;

const Img = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
`;

const FileGlyph = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: ${({ theme }) => theme?.colors?.grey60 ?? '#5c6270'};
`;

const Check = styled.span<{ $on: boolean }>`
  position: absolute;
  top: 6px;
  left: 6px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid #fff;
  background: ${({ $on, theme }) => ($on ? theme?.colors?.primary100 ?? '#4268f6' : 'rgba(0,0,0,0.35)')};
  color: #fff;
  font-size: 12px;
  line-height: 18px;
  text-align: center;
`;

const Name = styled.span`
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 3px 6px;
  font-size: 10px;
  color: #fff;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.65));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: left;
`;

const ext = (name: string): string => {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot + 1) : 'file';
};

export interface MediaGridProps {
  items: MediaItemDTO[];
  selectedIds?: Set<string>;
  selectable?: boolean;
  onOpen?: (item: MediaItemDTO) => void;
  onToggle?: (item: MediaItemDTO) => void;
}

export const MediaGrid: React.FC<MediaGridProps> = ({
  items,
  selectedIds,
  selectable = false,
  onOpen,
  onToggle,
}) => (
  <Grid>
    {items.map((item) => {
      const selected = !!selectedIds?.has(item.id);
      const isImage = mediaKindOf(item.mime) === 'image';
      return (
        <Tile
          key={item.id}
          type="button"
          $selected={selected}
          title={item.name}
          onClick={() => (selectable ? onToggle?.(item) : onOpen?.(item))}
        >
          {isImage ? (
            <Img src={item.url} alt={item.alt ?? item.name} loading="lazy" />
          ) : (
            <FileGlyph>
              <span style={{ fontSize: 22 }}>▤</span>
              {ext(item.name)}
            </FileGlyph>
          )}
          {selectable && <Check $on={selected}>{selected ? '✓' : ''}</Check>}
          <Name>{item.name}</Name>
        </Tile>
      );
    })}
  </Grid>
);
