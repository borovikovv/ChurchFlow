import { uploadToSignedUrl } from '@/lib/upload-to-signed-url';
import {
  confirmWebsiteSectionBackgroundImageAction,
  prepareWebsiteSectionBackgroundImageAction,
} from '../actions';

const allowedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const maxImageBytes = 5 * 1024 * 1024;

export interface WebsiteImageFields {
  file: string;
  assetId: string;
  url?: string;
  remove: string;
}

export interface WebsiteImageUploadMessages {
  tooLarge: string;
  uploadFailed: string;
  wrongType: string;
}

export const SECTION_BACKGROUND_IMAGE_FIELDS: WebsiteImageFields = {
  file: 'backgroundImageFile',
  assetId: 'backgroundImageAssetId',
  url: 'backgroundImageUrl',
  remove: 'removeBackgroundImage',
};

export const OG_IMAGE_FIELDS: WebsiteImageFields = {
  file: 'ogImageFile',
  assetId: 'ogImageAssetId',
  remove: 'removeOgImage',
};

// Uploads the image chosen in `fields.file` (if any) and rewrites the form so the submit
// carries the confirmed asset id instead of the file.
export async function uploadWebsiteImage(
  formData: FormData,
  fields: WebsiteImageFields,
  messages: WebsiteImageUploadMessages,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const file = formData.get(fields.file);
  formData.delete(fields.file);

  if (!(file instanceof File) || file.size === 0) {
    return { ok: true };
  }

  if (!allowedImageTypes.has(file.type)) {
    return { ok: false, error: messages.wrongType };
  }

  if (file.size > maxImageBytes) {
    return { ok: false, error: messages.tooLarge };
  }

  const organizationId = String(formData.get('organizationId') ?? '');
  const prepared = await prepareWebsiteSectionBackgroundImageAction({
    organizationId,
    filename: file.name,
    mimeType: file.type,
    byteSize: file.size,
  });

  if (!prepared.ok) {
    return { ok: false, error: prepared.error };
  }

  if (!(await uploadToSignedUrl(prepared.uploadUrl, file))) {
    return { ok: false, error: messages.uploadFailed };
  }

  const confirmed = await confirmWebsiteSectionBackgroundImageAction({
    organizationId,
    assetId: prepared.assetId,
  });

  if (!confirmed.ok) {
    return { ok: false, error: confirmed.error };
  }

  formData.set(fields.assetId, confirmed.assetId);
  if (fields.url) formData.set(fields.url, confirmed.imageUrl);
  formData.delete(fields.remove);

  return { ok: true };
}
