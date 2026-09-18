import { PHOTO_UPLOAD_MAX_BYTES, PHOTO_UPLOAD_MIME_TYPES } from '@churchflow/shared';

const allowedMimeTypes = new Set<string>(PHOTO_UPLOAD_MIME_TYPES);

export interface PhotoValidationMessages {
  invalidType: string;
  tooLarge: string;
}

const defaultValidationMessages: PhotoValidationMessages = {
  invalidType: 'Choose a JPEG, PNG, or WebP image.',
  tooLarge: 'The photo must not exceed 5 MB.',
};

export function validatePhotoFile(
  file: File | null,
  messages: PhotoValidationMessages = defaultValidationMessages,
): string | null {
  if (!file) return null;
  if (!allowedMimeTypes.has(file.type)) return messages.invalidType;
  if (file.size > PHOTO_UPLOAD_MAX_BYTES) return messages.tooLarge;
  return null;
}
