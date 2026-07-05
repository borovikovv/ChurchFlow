'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const maxPhotoBytes = 5 * 1024 * 1024;

export function validateMemberPhoto(file: File | null): string | null {
  if (!file) return null;
  if (!allowedMimeTypes.has(file.type)) return 'Choose a JPEG, PNG, or WebP image.';
  if (file.size > maxPhotoBytes) return 'The photo must not exceed 5 MB.';
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
    <div className="relative grid gap-2">
      <span className="font-semibold">Profile photo</span>
      {imageUrl ? (
        <Image
          className="h-20 w-20 rounded-full object-cover"
          src={imageUrl}
          alt="Selected profile preview"
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
        onBlur={() => onChange(file, validateMemberPhoto(file))}
        onChange={(event) => {
          const selected = event.currentTarget.files?.[0] ?? null;
          onChange(selected, validateMemberPhoto(selected));
        }}
      />
      <small>JPEG, PNG, or WebP. Maximum 5 MB. Uploaded when you save.</small>
      <span className="absolute bottom-0 left-0 text-xs font-medium text-[var(--danger)]">
        {error ?? ''}
      </span>
    </div>
  );
}
