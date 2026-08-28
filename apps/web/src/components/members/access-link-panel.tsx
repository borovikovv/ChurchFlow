'use client';

import { useTranslations } from 'next-intl';
import { CopyField } from '@/components/copy-field';
import { formatIsoDate } from '@/lib/format-date';

export function AccessLinkPanel({ url, expiresAt }: { url: string; expiresAt: string | null }) {
  const t = useTranslations('members');

  return (
    <div className="grid gap-2">
      <label>
        {t('accessUrl')}
        <CopyField value={url} />
      </label>
      {expiresAt ? (
        <p className="m-0 text-sm text-[var(--muted)]">
          {t('accessLinkExpires', { date: formatIsoDate(expiresAt) })}
        </p>
      ) : null}
      <p className="m-0 text-sm text-[var(--muted)]">{t('accessLinkShownOnce')}</p>
    </div>
  );
}
