import type { Area } from 'react-easy-crop';

export const CROPPED_IMAGE_SIZE = 512;

const PREFERRED_TYPE = 'image/webp';
const FALLBACK_TYPE = 'image/jpeg';
const QUALITY = 0.9;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Image could not be decoded'));
    image.src = src;
  });
}

function toBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, QUALITY));
}

export async function cropImageFile(src: string, area: Area, filename: string): Promise<File> {
  const image = await loadImage(src);
  const canvas = document.createElement('canvas');
  canvas.width = CROPPED_IMAGE_SIZE;
  canvas.height = CROPPED_IMAGE_SIZE;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas is not available');
  context.drawImage(
    image,
    area.x,
    area.y,
    area.width,
    area.height,
    0,
    0,
    CROPPED_IMAGE_SIZE,
    CROPPED_IMAGE_SIZE,
  );

  const preferred = await toBlob(canvas, PREFERRED_TYPE);
  const blob = preferred?.type === PREFERRED_TYPE ? preferred : await toBlob(canvas, FALLBACK_TYPE);
  if (!blob) throw new Error('Image could not be encoded');

  const extension = blob.type === PREFERRED_TYPE ? 'webp' : 'jpg';
  const baseName = filename.replace(/\.[^.]+$/, '') || 'photo';
  return new File([blob], `${baseName}.${extension}`, { type: blob.type });
}
