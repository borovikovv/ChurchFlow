import { organizationMediaContentUrl } from './private-media-url';

export interface StoredObject {
  bucket: string;
  objectKey: string;
}

export const userAvatarSelect = {
  avatarUrl: true,
  avatarAsset: { select: { id: true } },
} as const;

export interface UserAvatarSource {
  avatarUrl: string | null;
  avatarAsset: { id: string } | null;
}

/** The avatar of a user as another member of `organizationId` may load it. */
export function userAvatarUrl(
  user: UserAvatarSource | null | undefined,
  organizationId: string,
): string | null {
  if (!user) return null;
  return user.avatarAsset
    ? organizationMediaContentUrl(organizationId, user.avatarAsset.id)
    : user.avatarUrl;
}
