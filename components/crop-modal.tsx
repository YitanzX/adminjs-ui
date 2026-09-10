import React from 'react';
import ReactCrop, { centerCrop, makeAspectCrop } from 'react-image-crop';
import styled, { createGlobalStyle } from '@adminjs/design-system/styled-components';
import { Button } from '@adminjs/design-system';

import type { CropConfig } from '../shared.js';

/** Trimmed react-image-crop styles so we do not depend on the package CSS file. */
const CropStyles = createGlobalStyle`
  .ReactCrop { position: relative; display: inline-block; max-width: 100%; cursor: crosshair; }
  .ReactCrop *, .ReactCrop *::before, .ReactCrop *::after { box-sizing: border-box; }
  .ReactCrop__child-wrapper { max-height: 60vh; overflow: hidden; }
  .ReactCrop__child-wrapper > img { display: block; max-width: 100%; max-height: 60vh; }
  .ReactCrop__crop-selection {
    position: absolute; top: 0; left: 0; transform: translate3d(0, 0, 0);
    box-shadow: 0 0 0 9999em rgba(0, 0, 0, 0.5); border: 1px solid rgba(255, 255, 255, 0.7);
  }
  .ReactCrop--circular-crop .ReactCrop__crop-selection { border-radius: 50%; }
  .ReactCrop__drag-handle {
    position: absolute; width: 12px; height: 12px; background: #fff;
    border: 1px solid rgba(0, 0, 0, 0.4);
  }
  .ReactCrop__drag-handle.ord-nw { top: -6px; left: -6px; }
  .ReactCrop__drag-handle.ord-n { top: -6px; left: calc(50% - 6px); }
  .ReactCrop__drag-handle.ord-ne { top: -6px; right: -6px; }
  .ReactCrop__drag-handle.ord-e { top: calc(50% - 6px); right: -6px; }
  .ReactCrop__drag-handle.ord-se { bottom: -6px; right: -6px; }
  .ReactCrop__drag-handle.ord-s { bottom: -6px; left: calc(50% - 6px); }
  .ReactCrop__drag-handle.ord-sw { bottom: -6px; left: -6px; }
  .ReactCrop__drag-handle.ord-w { top: calc(50% - 6px); left: -6px; }
`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(0, 0, 0, 0.55);
`;

const Panel = styled.div`
  background: ${({ theme }) => theme?.colors?.white ?? '#fff'};
  color: ${({ theme }) => theme?.colors?.text ?? '#1c1c1c'};
  border-radius: 8px;
  padding: 20px;
  max-width: min(760px, 100%);
  max-height: 90vh;
  overflow: auto;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.3);
`;

const Actions = styled.div`
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 16px;
`;

const centeredCrop = (mediaWidth: number, mediaHeight: number, aspect?: number): any =>
  centerCrop(
    makeAspectCrop(
      { unit: '%', width: 90 },
      aspect && aspect > 0 ? aspect : mediaWidth / mediaHeight,
      mediaWidth,
      mediaHeight,
    ),
    mediaWidth,
    mediaHeight,
  );

const toBlob = (image: HTMLImageElement, crop: any, mime: string): Promise<Blob | null> => {
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(crop.width * scaleX));
  canvas.height = Math.max(1, Math.round(crop.height * scaleY));
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.resolve(null);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(
    image,
    crop.x * scaleX,
    crop.y * scaleY,
    crop.width * scaleX,
    crop.height * scaleY,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  return new Promise((resolve) => canvas.toBlob(resolve, mime || 'image/png', 0.92));
};

export interface CropModalProps {
  src: string;
  mime: string;
  fileName: string;
  config: CropConfig;
  onCancel: () => void;
  onConfirm: (blob: Blob) => void;
}

export const CropModal: React.FC<CropModalProps> = ({ src, mime, config, onCancel, onConfirm }) => {
  const imgRef = React.useRef<HTMLImageElement | null>(null);
  const [crop, setCrop] = React.useState<any>();
  const [completed, setCompleted] = React.useState<any>();
  const [busy, setBusy] = React.useState(false);

  const onImageLoad = (event: React.SyntheticEvent<HTMLImageElement>): void => {
    const { width, height } = event.currentTarget;
    setCrop(centeredCrop(width, height, config.aspect));
  };

  const confirm = async (): Promise<void> => {
    const image = imgRef.current;
    if (!image || !completed?.width) {
      onCancel();
      return;
    }
    setBusy(true);
    const blob = await toBlob(image, completed, mime);
    setBusy(false);
    if (blob) onConfirm(blob);
    else onCancel();
  };

  return (
    <Overlay onMouseDown={onCancel}>
      <CropStyles />
      <Panel onMouseDown={(event) => event.stopPropagation()}>
        <ReactCrop
          crop={crop}
          onChange={(pixelCrop: any) => setCrop(pixelCrop)}
          onComplete={(pixelCrop: any) => setCompleted(pixelCrop)}
          aspect={config.aspect && config.aspect > 0 ? config.aspect : undefined}
          circularCrop={!!config.circular}
          keepSelection
        >
          <img ref={imgRef} src={src} alt="" onLoad={onImageLoad} />
        </ReactCrop>
        <Actions>
          <Button variant="light" type="button" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" type="button" onClick={confirm} disabled={busy}>
            {busy ? 'Cropping…' : 'Apply crop'}
          </Button>
        </Actions>
      </Panel>
    </Overlay>
  );
};
