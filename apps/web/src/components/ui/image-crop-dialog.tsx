'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import Cropper, { type Area, type Point } from 'react-easy-crop';
import { toast } from 'react-toastify';
import { Button } from '@/components/ui/button';
import { FormDialog } from '@/components/ui/form-dialog';
import { cropImageFile } from './crop-image-file';

const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

export function ImageCropDialog({
  file,
  onCropped,
  onCancel,
}: {
  file: File | null;
  onCropped: (file: File) => void;
  onCancel: () => void;
}) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setImageSrc(url);
    return () => {
      URL.revokeObjectURL(url);
      setImageSrc(null);
    };
  }, [file]);

  if (!file || !imageSrc) return null;

  return (
    <CropDialog
      key={imageSrc}
      imageSrc={imageSrc}
      filename={file.name}
      onCropped={onCropped}
      onCancel={onCancel}
    />
  );
}

function CropDialog({
  imageSrc,
  filename,
  onCropped,
  onCancel,
}: {
  imageSrc: string;
  filename: string;
  onCropped: (file: File) => void;
  onCancel: () => void;
}) {
  const t = useTranslations('imageCrop');
  const commonT = useTranslations('common');
  const dialogRef = useRef<HTMLDialogElement>(null);
  const confirmedRef = useRef(false);
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [area, setArea] = useState<Area | null>(null);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  const apply = async () => {
    if (!area) return;
    setApplying(true);
    try {
      const cropped = await cropImageFile(imageSrc, area, filename);
      confirmedRef.current = true;
      onCropped(cropped);
      dialogRef.current?.close();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('failed'));
    } finally {
      setApplying(false);
    }
  };

  return (
    <FormDialog
      dialogRef={dialogRef}
      title={t('title')}
      footer={
        <>
          <Button
            type="button"
            variant="secondary"
            disabled={applying}
            onClick={() => dialogRef.current?.close()}
          >
            {commonT('cancel')}
          </Button>
          <Button type="button" disabled={!area || applying} onClick={apply}>
            {applying ? t('applying') : t('apply')}
          </Button>
        </>
      }
      onClose={() => {
        if (!confirmedRef.current) onCancel();
      }}
    >
      <div className="grid gap-4">
        <div className="relative h-[min(60vw,320px)] w-full overflow-hidden rounded-[var(--radius)] bg-[var(--surface-subtle)]">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            minZoom={MIN_ZOOM}
            maxZoom={MAX_ZOOM}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={(_croppedArea, croppedAreaPixels) => setArea(croppedAreaPixels)}
          />
        </div>
        <label className="grid gap-1 text-sm">
          <span className="font-semibold">{t('zoom')}</span>
          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.05}
            value={zoom}
            onChange={(event) => setZoom(Number(event.currentTarget.value))}
          />
        </label>
      </div>
    </FormDialog>
  );
}
