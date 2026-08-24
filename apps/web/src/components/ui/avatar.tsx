'use client';

import { useEffect, useRef, useState } from 'react';
import { displayNameInitials } from '@/lib/initials';

type AvatarSize = 'sm' | 'md' | 'lg';
type AvatarFallback = 'icon' | 'initials';

const NO_AVATAR_ICON_PATH = '/icons/no-avatar.svg';

/**
 * Telegram answers an expired userpic URL with a 1x1 transparent GIF instead of a failure, so the
 * image decodes, `load` fires and `error` never does. Comparing against zero would miss it.
 */
const MIN_PHOTO_SIZE = 2;

function isMissingPhoto(image: HTMLImageElement): boolean {
  return image.naturalWidth < MIN_PHOTO_SIZE || image.naturalHeight < MIN_PHOTO_SIZE;
}

const avatarSizeClasses: Record<AvatarSize, string> = {
  sm: 'h-10 w-10',
  md: 'h-14 w-14',
  lg: 'h-20 w-20 sm:h-24 sm:w-24',
};

const initialsSizeClasses: Record<AvatarSize, string> = {
  sm: 'text-sm',
  md: 'text-lg',
  lg: 'text-2xl sm:text-3xl',
};

export function Avatar({
  displayName,
  url,
  fallback = 'icon',
  size = 'sm',
}: {
  displayName: string;
  url: string | null;
  fallback?: AvatarFallback;
  size?: AvatarSize;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const showPhoto = Boolean(url) && failedUrl !== url;
  const initials = displayNameInitials(displayName);
  const useInitials = fallback === 'initials' && initials !== '';

  useEffect(() => {
    const image = imageRef.current;
    if (url && image?.complete && isMissingPhoto(image)) setFailedUrl(url);
  }, [url]);

  return (
    <span
      className={[
        avatarSizeClasses[size],
        'relative grid shrink-0 place-items-center overflow-hidden rounded-full',
        useInitials ? 'border border-[var(--line)] bg-[var(--surface-subtle)]' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {useInitials ? (
        <span
          aria-hidden="true"
          className={`${initialsSizeClasses[size]} font-semibold text-[var(--muted)]`}
        >
          {initials}
        </span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          aria-hidden="true"
          alt=""
          className="h-full w-full object-cover"
          src={NO_AVATAR_ICON_PATH}
        />
      )}
      {showPhoto && url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt={displayName}
          className="absolute inset-0 h-full w-full object-cover"
          ref={imageRef}
          src={url}
          onError={() => setFailedUrl(url)}
          onLoad={(event) => {
            if (isMissingPhoto(event.currentTarget)) setFailedUrl(url);
          }}
        />
      ) : null}
    </span>
  );
}
