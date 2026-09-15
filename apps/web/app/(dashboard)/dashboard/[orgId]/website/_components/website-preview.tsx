'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

const DEVICES = [
  { id: 'desktop', width: null },
  { id: 'tablet', width: 834 },
  { id: 'mobile', width: 390 },
] as const;

type DeviceId = (typeof DEVICES)[number]['id'];

// The preview is the real public renderer fed with the draft through an owner-only route, so
// it is reloaded (via `version`) after every saved change rather than re-rendered locally.
export function WebsitePreview({
  organizationId,
  pageId,
  version,
}: {
  organizationId: string;
  pageId: string | undefined;
  version: number;
}) {
  const t = useTranslations('website');
  const [device, setDevice] = useState<DeviceId>('desktop');
  const width = DEVICES.find((option) => option.id === device)?.width ?? null;

  return (
    <section className="grid min-w-0 content-start gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-md border border-[var(--line)] bg-[var(--surface-subtle)] p-0.5">
          {DEVICES.map((option) => (
            <button
              aria-pressed={device === option.id}
              className={`cursor-pointer rounded border-0 px-3 py-1.5 text-sm font-semibold ${
                device === option.id
                  ? 'bg-[var(--surface)] text-[var(--foreground)] shadow-[var(--shadow)]'
                  : 'bg-transparent text-[var(--muted)]'
              }`}
              key={option.id}
              onClick={() => setDevice(option.id)}
              type="button"
            >
              {t(`devices.${option.id}`)}
            </button>
          ))}
        </div>
        <span className="text-xs text-[var(--muted)]">{t('previewHint')}</span>
      </div>
      <div className="overflow-auto rounded-md border border-[var(--line)] bg-[#eaeef2] p-4">
        {pageId ? (
          <iframe
            className="mx-auto block h-[720px] max-w-full rounded bg-white shadow-[0_8px_24px_rgba(140,149,159,0.2)]"
            key={`${pageId}:${version}:${device}`}
            src={`/o/preview/${organizationId}/${pageId}?v=${version}`}
            style={{ width: width ?? '100%' }}
            title={t('previewTitle')}
          />
        ) : (
          <p className="m-0 p-8 text-center text-sm text-[var(--muted)]">{t('noPageToPreview')}</p>
        )}
      </div>
    </section>
  );
}
