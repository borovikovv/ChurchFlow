'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ImageCropDialog } from '@/components/ui/image-crop-dialog';
import { uploadToSignedUrl } from '@/lib/upload-to-signed-url';
import { validatePhotoFile } from '@/lib/validate-photo-file';
import { confirmAvatarUpload, prepareAvatarUpload, removeAvatar } from '../actions';
import { ProfileCard } from './profile-card';
import { removeAvatarButtonClassName } from './profile-avatar.styles';

export function ProfileAvatar({
  displayName,
  avatarUrl: initialAvatarUrl,
  organizationId,
}: {
  displayName: string | null;
  avatarUrl: string | null;
  organizationId: string;
}) {
  const t = useTranslations('profile');
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
  const [fileToCrop, setFileToCrop] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const resetInput = () => {
    if (inputRef.current) inputRef.current.value = '';
  };

  const upload = async (photo: File) => {
    setBusy(true);
    try {
      const prepared = await prepareAvatarUpload({
        filename: photo.name,
        mimeType: photo.type,
        byteSize: photo.size,
      });
      if (!prepared.ok) throw new Error(prepared.error);
      if (!(await uploadToSignedUrl(prepared.uploadUrl, photo)))
        throw new Error(t('photoUploadFailed'));
      const confirmed = await confirmAvatarUpload({ assetId: prepared.assetId, organizationId });
      if (!confirmed.ok) throw new Error(confirmed.error);
      setAvatarUrl(confirmed.avatarUrl);
      toast.success(t('photoUpdated'));
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('photoUploadFailed'));
    } finally {
      setBusy(false);
      resetInput();
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      const result = await removeAvatar();
      if (!result.ok) throw new Error(result.error);
      setAvatarUrl(null);
      toast.success(t('photoRemoved'));
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('photoRemoveFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ProfileCard title={t('photo')} description={t('photoDescription')}>
      <div className="flex flex-wrap items-center gap-5">
        <div className="group relative">
          <Avatar displayName={displayName ?? ''} url={avatarUrl} fallback="initials" size="lg" />
          {avatarUrl ? (
            <button
              aria-label={t('removePhoto')}
              className={removeAvatarButtonClassName}
              disabled={busy}
              type="button"
              onClick={remove}
            >
              <svg aria-hidden="true" className="h-4 w-4 fill-current" viewBox="0 0 20 20">
                <path d="M7 2.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1V4h3.5a.75.75 0 0 1 0 1.5h-.8l-.7 11.2A2 2 0 0 1 13 18.5H7a2 2 0 0 1-2-1.8L4.3 5.5h-.8a.75.75 0 0 1 0-1.5H7V2.5Zm1.5 1.5h3v-1h-3v1ZM5.8 5.5l.7 11.1a.5.5 0 0 0 .5.4h6a.5.5 0 0 0 .5-.4l.7-11.1H5.8Zm2.45 2a.75.75 0 0 1 .75.75v6a.75.75 0 0 1-1.5 0v-6a.75.75 0 0 1 .75-.75Zm3.5 0a.75.75 0 0 1 .75.75v6a.75.75 0 0 1-1.5 0v-6a.75.75 0 0 1 .75-.75Z" />
              </svg>
            </button>
          ) : null}
        </div>
        <div className="grid gap-2">
          <Button
            disabled={busy}
            type="button"
            variant="secondary"
            onClick={() => inputRef.current?.click()}
          >
            {busy ? t('photoUploading') : avatarUrl ? t('changePhoto') : t('addPhoto')}
          </Button>
          <small className="text-[var(--muted)]">{t('photoRequirement')}</small>
        </div>
      </div>
      <input
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        ref={inputRef}
        type="file"
        onChange={(event) => {
          const selected = event.currentTarget.files?.[0] ?? null;
          const validationError = validatePhotoFile(selected, {
            invalidType: t('chooseImageFile'),
            tooLarge: t('photoTooLarge'),
          });
          if (validationError) {
            toast.error(validationError);
            resetInput();
            return;
          }
          setFileToCrop(selected);
        }}
      />
      <ImageCropDialog
        file={fileToCrop}
        onCropped={(cropped) => {
          setFileToCrop(null);
          void upload(cropped);
        }}
        onCancel={() => {
          setFileToCrop(null);
          resetInput();
        }}
      />
    </ProfileCard>
  );
}
