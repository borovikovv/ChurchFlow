import {
  LOGO_UPLOAD_MIME_TYPES,
  PHOTO_UPLOAD_MAX_BYTES,
  PHOTO_UPLOAD_MIME_TYPES,
} from '@churchflow/shared';

const allowedMimeTypes = new Set<string>(PHOTO_UPLOAD_MIME_TYPES);
const allowedLogoMimeTypes = new Set<string>(LOGO_UPLOAD_MIME_TYPES);

export interface PhotoValidationMessages {
  invalidType: string;
  tooLarge: string;
}

const defaultValidationMessages: PhotoValidationMessages = {
  invalidType: 'Choose a JPEG, PNG, or WebP image.',
  tooLarge: 'The photo must not exceed 5 MB.',
};

const logoValidationMessages: PhotoValidationMessages = {
  invalidType: 'Choose a JPEG, PNG, WebP, or SVG image.',
  tooLarge: 'The logo must not exceed 5 MB.',
};

export function validatePhotoFile(
  file: File | null,
  messages: PhotoValidationMessages = defaultValidationMessages,
): string | null {
  return validateImageFile(file, allowedMimeTypes, messages);
}

export function validateLogoFile(file: File | null): string | null {
  return validateImageFile(file, allowedLogoMimeTypes, logoValidationMessages);
}

function validateImageFile(
  file: File | null,
  allowed: Set<string>,
  messages: PhotoValidationMessages,
): string | null {
  if (!file) return null;
  if (!allowed.has(file.type)) return messages.invalidType;
  if (file.size > PHOTO_UPLOAD_MAX_BYTES) return messages.tooLarge;
  return null;
}
