'use client';

import { useTranslations } from 'next-intl';
import { Checkbox } from '@/components/ui/checkbox';
import { OG_IMAGE_FIELDS } from './website-image-upload';

export function OgImageFields({
  ogImageAssetId,
  ogImageUrl,
}: {
  ogImageAssetId: string;
  ogImageUrl: string;
}) {
  const t = useTranslations('website');

  return (
    <>
      <label>
        {t('ogImage')}
        <input accept="image/jpeg,image/png,image/webp" name={OG_IMAGE_FIELDS.file} type="file" />
        <span className="text-xs text-[var(--muted)]">{t('ogImageHint')}</span>
      </label>
      <input name={OG_IMAGE_FIELDS.assetId} type="hidden" value={ogImageAssetId} />
      {ogImageUrl ? (
        <div className="grid gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt={t('ogImagePreview')}
            className="aspect-[1.91/1] w-full max-w-sm rounded-md border border-[var(--line)] bg-[var(--surface)] object-cover"
            src={ogImageUrl}
          />
          <Checkbox label={t('removeOgImage')} name={OG_IMAGE_FIELDS.remove} value="true" />
        </div>
      ) : null}
    </>
  );
}
