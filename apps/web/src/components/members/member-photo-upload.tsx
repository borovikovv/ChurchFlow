'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';

const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const maxPhotoBytes = 5 * 1024 * 1024;

interface MemberPhotoValidationMessages {
  invalidType: string;
  tooLarge: string;
}

const defaultValidationMessages: MemberPhotoValidationMessages = {
  invalidType: 'Choose a JPEG, PNG, or WebP image.',
  tooLarge: 'The photo must not exceed 5 MB.',
};

export function validateMemberPhoto(
  file: File | null,
  messages: MemberPhotoValidationMessages = defaultValidationMessages,
): string | null {
  if (!file) return null;
  if (!allowedMimeTypes.has(file.type)) return messages.invalidType;
  if (file.size > maxPhotoBytes) return messages.tooLarge;
  return null;
}

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
        onBlur={() => onChange(file, validateMemberPhoto(file, validationMessages))}
        onChange={(event) => {
          const selected = event.currentTarget.files?.[0] ?? null;
          onChange(selected, validateMemberPhoto(selected, validationMessages));
        }}
      />
      <div className="grid gap-1">
        <small>{t('photoRequirement')}</small>
        {error ? <p className="form-error m-0 text-xs">{error}</p> : null}
      </div>
    </div>
  );
}
