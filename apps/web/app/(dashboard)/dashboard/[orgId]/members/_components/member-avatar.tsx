'use client';

import { useState } from 'react';

type MemberAvatarSize = 'sm' | 'md' | 'lg';

const NO_AVATAR_ICON_PATH = '/icons/no-avatar.svg';

const avatarSizeClasses: Record<MemberAvatarSize, string> = {
  sm: 'h-10 w-10',
  md: 'h-14 w-14',
  lg: 'h-20 w-20 sm:h-24 sm:w-24',
};

export function MemberAvatar({
  displayName,
  url,
  size = 'sm',
}: {
  displayName: string;
  url: string | null;
  size?: MemberAvatarSize;
}) {
  const sizeClass = avatarSizeClasses[size];
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const imageLoadFailed = Boolean(url && failedUrl === url);

  const imageUrl = url && !imageLoadFailed ? url : NO_AVATAR_ICON_PATH;

  return (
    // eslint requires the same exception here because this route already renders avatars with img.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={`${sizeClass} shrink-0 rounded-full object-cover`}
      src={imageUrl}
      alt={url && !imageLoadFailed ? displayName : ''}
      aria-hidden={!url || imageLoadFailed ? 'true' : undefined}
      onError={() => {
        if (url && imageUrl !== NO_AVATAR_ICON_PATH) setFailedUrl(url);
      }}
    />
  );
}
