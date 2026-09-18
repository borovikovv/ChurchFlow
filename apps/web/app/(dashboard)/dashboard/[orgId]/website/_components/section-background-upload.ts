import { uploadToSignedUrl } from '@/lib/upload-to-signed-url';
import {
  confirmWebsiteSectionBackgroundImageAction,
  prepareWebsiteSectionBackgroundImageAction,
} from '../actions';

const allowedBackgroundImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const maxBackgroundImageBytes = 5 * 1024 * 1024;

export interface WebsiteUploadMessages {
  backgroundImageTooLarge: string;
  backgroundImageUploadFailed: string;
  chooseBackgroundImage: string;
}

export async function uploadSectionBackgroundImage(
  formData: FormData,
  messages: WebsiteUploadMessages,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const file = formData.get('backgroundImageFile');
  formData.delete('backgroundImageFile');

  if (!(file instanceof File) || file.size === 0) {
    return { ok: true };
  }

  if (!allowedBackgroundImageTypes.has(file.type)) {
    return { ok: false, error: messages.chooseBackgroundImage };
  }

  if (file.size > maxBackgroundImageBytes) {
    return { ok: false, error: messages.backgroundImageTooLarge };
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
    return { ok: false, error: messages.backgroundImageUploadFailed };
  }

  const confirmed = await confirmWebsiteSectionBackgroundImageAction({
    organizationId,
    assetId: prepared.assetId,
  });

  if (!confirmed.ok) {
    return { ok: false, error: confirmed.error };
  }

  formData.set('backgroundImageAssetId', confirmed.assetId);
  formData.set('backgroundImageUrl', confirmed.imageUrl);
  formData.delete('removeBackgroundImage');

  return { ok: true };
}
