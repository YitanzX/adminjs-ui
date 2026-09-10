import React from 'react';
import styled from '@adminjs/design-system/styled-components';
import { Box, Button, H4, Input, Label } from '@adminjs/design-system';

import { formatBytes } from '../shared.js';
import { mediaKindOf, type MediaItemDTO, type MediaKind } from '../media/types.js';
import { deleteMedia, patchMedia, useMediaBrowser } from './use-media.js';
import { MediaGrid } from './media-grid.js';
import { MediaUploader } from './media-uploader.js';

const KIND_OPTIONS: Array<{ value: MediaKind | 'all'; label: string }> = [
  { value: 'all', label: 'All media' },
  { value: 'image', label: 'Images' },
  { value: 'video', label: 'Video' },
  { value: 'audio', label: 'Audio' },
  { value: 'document', label: 'Documents' },
];

const Layout = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
  align-items: start;

  @media (min-width: 1080px) {
    grid-template-columns: 1fr 320px;
  }
`;

const Toolbar = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-bottom: 14px;
`;

const Sidebar = styled(Box)`
  border-radius: 10px;
  padding: 16px;
  position: sticky;
  top: 12px;
`;

const Preview = styled.div<{ $src: string; $image: boolean }>`
  width: 100%;
  aspect-ratio: 1 / 1;
  border-radius: 8px;
  border: 1px solid ${({ theme }) => theme?.colors?.border ?? '#e0e2e8'};
  margin-bottom: 12px;
  background: ${({ theme }) => theme?.colors?.grey20 ?? '#f4f5f7'}
    ${({ $src, $image }) => ($image ? `url(${$src}) center / contain no-repeat` : 'none')};
  display: ${({ $image }) => ($image ? 'block' : 'flex')};
  align-items: center;
  justify-content: center;
  color: #8a909c;
  font-size: 12px;
`;

const Meta = styled.dl`
  margin: 0 0 12px;
  font-size: 12px;
  display: grid;
  grid-template-columns: 76px 1fr;
  row-gap: 4px;
  color: ${({ theme }) => theme?.colors?.grey80 ?? '#3b3f4a'};

  dt {
    color: ${({ theme }) => theme?.colors?.grey60 ?? '#6b7280'};
  }
  dd {
    margin: 0;
    word-break: break-word;
  }
`;

const Bulk = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 8px 12px;
  margin-bottom: 12px;
  border-radius: 8px;
  background: ${({ theme }) => theme?.colors?.primary20 ?? '#eef2ff'};
  font-size: 13px;
`;

const DetailPanel: React.FC<{
  item: MediaItemDTO;
  onChange: (item: MediaItemDTO) => void;
  onDeleted: (id: string) => void;
}> = ({ item, onChange, onDeleted }) => {
  const [alt, setAlt] = React.useState(item.alt ?? '');
  const [title, setTitle] = React.useState(item.title ?? '');
  const [copied, setCopied] = React.useState(false);
  const isImage = mediaKindOf(item.mime) === 'image';

  React.useEffect(() => {
    setAlt(item.alt ?? '');
    setTitle(item.title ?? '');
  }, [item.id, item.alt, item.title]);

  const persist = (patch: { alt?: string; title?: string }): void => {
    patchMedia(item.id, patch)
      .then(onChange)
      .catch(() => undefined);
  };

  const copyUrl = (): void => {
    void navigator.clipboard?.writeText(item.url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const remove = (): void => {
    if (!window.confirm(`Delete "${item.name}" permanently?`)) return;
    deleteMedia(item.id)
      .then(() => onDeleted(item.id))
      .catch(() => undefined);
  };

  return (
    <Sidebar variant="white" boxShadow="card">
      <Preview $src={item.url} $image={isImage}>
        {!isImage && item.mime}
      </Preview>
      <Meta>
        <dt>Name</dt>
        <dd>{item.name}</dd>
        <dt>Type</dt>
        <dd>{item.mime}</dd>
        {item.width && item.height ? (
          <>
            <dt>Size</dt>
            <dd>
              {item.width} × {item.height}
            </dd>
          </>
        ) : null}
        <dt>File</dt>
        <dd>{formatBytes(item.size)}</dd>
        <dt>Added</dt>
        <dd>{new Date(item.createdAt).toLocaleDateString()}</dd>
      </Meta>

      <Box style={{ marginBottom: 8 }}>
        <Label>Alt text</Label>
        <Input value={alt} onChange={(event) => setAlt(event.target.value)} onBlur={() => persist({ alt })} />
      </Box>
      <Box style={{ marginBottom: 12 }}>
        <Label>Title</Label>
        <Input value={title} onChange={(event) => setTitle(event.target.value)} onBlur={() => persist({ title })} />
      </Box>

      <Box style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Button type="button" size="sm" variant="light" onClick={copyUrl}>
          {copied ? 'Copied!' : 'Copy URL'}
        </Button>
        <Button type="button" size="sm" variant="danger" onClick={remove}>
          Delete permanently
        </Button>
      </Box>
    </Sidebar>
  );
};

const MediaLibrary: React.FC = () => {
  const browser = useMediaBrowser();
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [selecting, setSelecting] = React.useState(false);
  const [term, setTerm] = React.useState('');

  React.useEffect(() => {
    const handle = setTimeout(() => browser.setSearch(term), 300);
    return () => clearTimeout(handle);
  }, [term, browser]);

  const open = browser.items.find((item) => item.id === openId) ?? null;

  const toggle = (item: MediaItemDTO): void =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(item.id)) next.delete(item.id);
      else next.add(item.id);
      return next;
    });

  const bulkDelete = async (): Promise<void> => {
    if (!window.confirm(`Delete ${selected.size} item(s) permanently?`)) return;
    for (const id of selected) {
      await deleteMedia(id).catch(() => undefined);
      browser.removeLocal(id);
    }
    setSelected(new Set());
    setSelecting(false);
  };

  return (
    <Box style={{ padding: 24 }}>
      <H4 style={{ marginTop: 0 }}>Media Library</H4>

      <Toolbar>
        <Input
          placeholder="Search media…"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          style={{ maxWidth: 240 }}
        />
        <select
          value={browser.kind}
          onChange={(event) => browser.setKind(event.target.value as MediaKind | 'all')}
          style={{ padding: '6px 8px', borderRadius: 4, border: '1px solid #e0e2e8' }}
        >
          {KIND_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <div style={{ flex: 1 }} />
        <Button
          type="button"
          size="sm"
          variant={selecting ? 'primary' : 'light'}
          onClick={() => {
            setSelecting((value) => !value);
            setSelected(new Set());
          }}
        >
          {selecting ? 'Done' : 'Select'}
        </Button>
      </Toolbar>

      <Box style={{ marginBottom: 16 }}>
        <MediaUploader onUploaded={(item) => browser.prepend(item)} />
      </Box>

      {selecting && selected.size > 0 && (
        <Bulk>
          <span>{selected.size} selected</span>
          <Button type="button" size="sm" variant="danger" onClick={bulkDelete}>
            Delete
          </Button>
        </Bulk>
      )}

      {browser.error && <Box style={{ color: '#b3261e', marginBottom: 12 }}>{browser.error}</Box>}

      <Layout>
        <div>
          {browser.items.length === 0 && !browser.loading ? (
            <Box style={{ color: '#8a909c', padding: '24px 0' }}>No media yet — drop a file above.</Box>
          ) : (
            <MediaGrid
              items={browser.items}
              selectable={selecting}
              selectedIds={selected}
              onToggle={toggle}
              onOpen={(item) => setOpenId(item.id)}
            />
          )}

          <Box style={{ marginTop: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
            {browser.hasMore && (
              <Button type="button" size="sm" variant="light" onClick={browser.loadMore} disabled={browser.loading}>
                {browser.loading ? 'Loading…' : 'Load more'}
              </Button>
            )}
            <span style={{ fontSize: 12, color: '#8a909c' }}>
              {browser.items.length} of {browser.total}
            </span>
          </Box>
        </div>

        {open && (
          <DetailPanel
            item={open}
            onChange={(item) => browser.replace(item)}
            onDeleted={(id) => {
              browser.removeLocal(id);
              setOpenId(null);
            }}
          />
        )}
      </Layout>
    </Box>
  );
};

export default MediaLibrary;
