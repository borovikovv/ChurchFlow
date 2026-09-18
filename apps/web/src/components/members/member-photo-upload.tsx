'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { ImageCropDialog } from '@/components/ui/image-crop-dialog';
import { validatePhotoFile } from '@/lib/validate-photo-file';

export function MemberPhotoField({
  currentUrl,
  file,
  onChange,
  error,
}: {
  currentUrl: string | null;
  file: File | null;
  onChange: (file: File | null, error: string | null) => void;
  error: string | null;
}) {
  const t = useTranslations('members');
  const validationMessages = {
    invalidType: t('chooseImageFile'),
    tooLarge: t('photoTooLarge'),
  };
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileToCrop, setFileToCrop] = useState<File | null>(null);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const imageUrl = previewUrl ?? currentUrl;
  return (
    <div className="grid gap-2">
      <span className="font-semibold">{t('profilePhoto')}</span>
      {imageUrl ? (
        <Image
          className="h-20 w-20 rounded-full object-cover"
          src={imageUrl}
          alt={t('profilePhotoPreview')}
          width={80}
          height={80}
          unoptimized
        />
      ) : null}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        aria-invalid={Boolean(error)}
        onBlur={() => onChange(file, validatePhotoFile(file, validationMessages))}
        onChange={(event) => {
          const selected = event.currentTarget.files?.[0] ?? null;
          const validationError = validatePhotoFile(selected, validationMessages);
          if (validationError || !selected) {
            onChange(selected, validationError);
            return;
          }
          setFileToCrop(selected);
        }}
      />
      <div className="grid gap-1">
        <small>{t('photoRequirement')}</small>
        {error ? <p className="form-error m-0 text-xs">{error}</p> : null}
      </div>
      <ImageCropDialog
        file={fileToCrop}
        onCropped={(cropped) => {
          setFileToCrop(null);
          onChange(cropped, null);
        }}
        onCancel={() => {
          setFileToCrop(null);
          if (inputRef.current) inputRef.current.value = '';
        }}
      />
    </div>
  );
}
