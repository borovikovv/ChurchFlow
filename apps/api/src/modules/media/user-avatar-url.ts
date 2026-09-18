export interface StoredObject {
  bucket: string;
  objectKey: string;
}

export type ReadUrlLookup = (object: StoredObject | null | undefined) => string | null;

export const userAvatarSelect = {
  avatarUrl: true,
  avatarAsset: { select: { bucket: true, objectKey: true } },
} as const;

export interface UserAvatarSource {
  avatarUrl: string | null;
  avatarAsset: StoredObject | null;
}

export function userAvatarUrl(
  user: UserAvatarSource | null | undefined,
  readUrl: ReadUrlLookup,
): string | null {
  if (!user) return null;
  return user.avatarAsset ? readUrl(user.avatarAsset) : user.avatarUrl;
}
