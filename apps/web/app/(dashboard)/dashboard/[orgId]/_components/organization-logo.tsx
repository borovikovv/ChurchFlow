'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { validateMemberPhoto } from '@/components/members/member-photo-upload';

function organizationInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function OrganizationLogo({
  name,
  url,
  size = 'large',
}: {
  name: string;
  url: string | null;
  size?: 'large' | 'small';
}) {
  const className = size === 'large' ? 'h-20 w-20 text-2xl' : 'h-16 w-16 text-xl';

  if (url) {
    return (
      <Image
        className={`${className} rounded-lg object-cover`}
        src={url}
        alt={`${name} logo`}
        width={80}
        height={80}
        unoptimized
      />
    );
  }

  return (
    <div
      aria-hidden="true"
      className={`${className} grid place-items-center rounded-lg border border-[var(--line)] bg-[var(--surface-subtle)] font-semibold text-[var(--accent)]`}
    >
      {organizationInitials(name) || 'CF'}
    </div>
  );
}

export function OrganizationLogoField({
  currentUrl,
  organizationName,
  file,
  error,
  onChange,
}: {
  currentUrl: string | null;
  organizationName: string;
  file: File | null;
  error: string | null;
  onChange: (file: File | null, error: string | null) => void;
}) {
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

  return (
    <div className="grid gap-2">
      <span className="font-semibold">Logo</span>
      <OrganizationLogo name={organizationName} url={previewUrl ?? currentUrl} size="small" />
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        aria-invalid={Boolean(error)}
        onBlur={() => onChange(file, validateMemberPhoto(file))}
        onChange={(event) => {
          const selected = event.currentTarget.files?.[0] ?? null;
          onChange(selected, validateMemberPhoto(selected));
        }}
      />
      <div className="grid gap-1">
        <small>JPEG, PNG, or WebP. Maximum 5 MB. Uploaded when you save.</small>
        {error ? <p className="form-error m-0 text-xs">{error}</p> : null}
      </div>
    </div>
  );
}
