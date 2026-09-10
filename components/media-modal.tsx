import React from 'react';
import styled from 'styled-components';
import { Box, Button, Input } from '@adminjs/design-system';

import { type MediaItemDTO, type MediaKind } from '../media/types.js';
import { useMediaBrowser } from './use-media.js';
import { MediaGrid } from './media-grid.js';
import { MediaUploader } from './media-uploader.js';

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 1200;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
`;

const Panel = styled.div`
  background: ${({ theme }) => theme?.colors?.white ?? '#fff'};
  color: ${({ theme }) => theme?.colors?.text ?? '#1c1c1c'};
  width: min(920px, 100%);
  max-height: 88vh;
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const Head = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid ${({ theme }) => theme?.colors?.border ?? '#e0e2e8'};
`;

const Bodyscroll = styled.div`
  padding: 16px;
  overflow: auto;
`;

const Foot = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid ${({ theme }) => theme?.colors?.border ?? '#e0e2e8'};
`;

const Tab = styled.button<{ $active: boolean }>`
  border: none;
  background: none;
  padding: 6px 4px;
  font-size: 13px;
  cursor: pointer;
  border-bottom: 2px solid ${({ $active, theme }) => ($active ? theme?.colors?.primary100 ?? '#4268f6' : 'transparent')};
  color: ${({ $active, theme }) => ($active ? theme?.colors?.text ?? '#1c1c1c' : theme?.colors?.grey60 ?? '#6b7280')};
`;

export interface MediaModalProps {
  multiple?: boolean;
  onClose: () => void;
  onConfirm: (items: MediaItemDTO[]) => void;
}

export const MediaModal: React.FC<MediaModalProps> = ({ multiple = false, onClose, onConfirm }) => {
  const browser = useMediaBrowser();
  const [tab, setTab] = React.useState<'library' | 'upload'>('library');
  const [picked, setPicked] = React.useState<Map<string, MediaItemDTO>>(new Map());
  const [term, setTerm] = React.useState('');

  React.useEffect(() => {
    const handle = setTimeout(() => browser.setSearch(term), 300);
    return () => clearTimeout(handle);
  }, [term, browser]);

  const toggle = (item: MediaItemDTO): void =>
    setPicked((current) => {
      const next = new Map(multiple ? current : []);
      if (next.has(item.id)) next.delete(item.id);
      else next.set(item.id, item);
      return next;
    });

  return (
    <Overlay onMouseDown={onClose}>
      <Panel onMouseDown={(event) => event.stopPropagation()}>
        <Head>
          <Tab $active={tab === 'library'} type="button" onClick={() => setTab('library')}>
            Media Library
          </Tab>
          <Tab $active={tab === 'upload'} type="button" onClick={() => setTab('upload')}>
            Upload
          </Tab>
          <div style={{ flex: 1 }} />
          {tab === 'library' && (
            <>
              <Input
                placeholder="Search…"
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                style={{ maxWidth: 180 }}
              />
              <select
                value={browser.kind}
                onChange={(event) => browser.setKind(event.target.value as MediaKind | 'all')}
                style={{ padding: '6px 8px', borderRadius: 4, border: '1px solid #e0e2e8' }}
              >
                <option value="all">All</option>
                <option value="image">Images</option>
                <option value="video">Video</option>
                <option value="audio">Audio</option>
                <option value="document">Documents</option>
              </select>
            </>
          )}
        </Head>

        <Bodyscroll>
          {tab === 'upload' ? (
            <MediaUploader
              onUploaded={(item) => {
                browser.prepend(item);
                setPicked((current) => {
                  const next = new Map(multiple ? current : []);
                  next.set(item.id, item);
                  return next;
                });
                setTab('library');
              }}
            />
          ) : browser.items.length === 0 && !browser.loading ? (
            <Box style={{ color: '#8a909c', padding: '24px 0' }}>No media — switch to Upload.</Box>
          ) : (
            <>
              <MediaGrid items={browser.items} selectable selectedIds={new Set(picked.keys())} onToggle={toggle} />
              {browser.hasMore && (
                <Box style={{ marginTop: 12 }}>
                  <Button type="button" size="sm" variant="light" onClick={browser.loadMore} disabled={browser.loading}>
                    {browser.loading ? 'Loading…' : 'Load more'}
                  </Button>
                </Box>
              )}
            </>
          )}
        </Bodyscroll>

        <Foot>
          <span style={{ fontSize: 12, color: '#8a909c' }}>{picked.size} selected</span>
          <Box style={{ display: 'flex', gap: 8 }}>
            <Button type="button" variant="light" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={picked.size === 0}
              onClick={() => onConfirm([...picked.values()])}
            >
              Use {picked.size > 0 ? picked.size : ''} {multiple ? 'files' : 'file'}
            </Button>
          </Box>
        </Foot>
      </Panel>
    </Overlay>
  );
};
