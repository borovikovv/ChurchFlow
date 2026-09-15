'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

const DEVICES = [
  { id: 'desktop', width: 1440 },
  { id: 'tablet', width: 834 },
  { id: 'mobile', width: 390 },
] as const;

const PREVIEW_HEIGHT = 720;

type DeviceId = (typeof DEVICES)[number]['id'];

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
  const [containerWidth, setContainerWidth] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const width = DEVICES.find((option) => option.id === device)?.width ?? 1440;
  const scale = containerWidth ? Math.min(1, containerWidth / width) : 1;

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const measure = () => setContainerWidth(element.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

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
              {t(`devices.${option.id}`)} · {option.width}
            </button>
          ))}
        </div>
        <span className="text-xs text-[var(--muted)]">
          {t('previewHint')}
          {scale < 1 ? ` · ${Math.round(scale * 100)}%` : ''}
        </span>
      </div>
      <div className="overflow-hidden rounded-md border border-[var(--line)] bg-[#eaeef2] p-4">
        <div className="w-full" ref={containerRef} />
        {pageId ? (
          <div className="mx-auto" style={{ width: width * scale, height: PREVIEW_HEIGHT * scale }}>
            <iframe
              className="block origin-top-left rounded bg-white shadow-[0_8px_24px_rgba(140,149,159,0.2)]"
              key={`${pageId}:${version}`}
              src={`/o/preview/${organizationId}/${pageId}?v=${version}`}
              style={{ width, height: PREVIEW_HEIGHT, transform: `scale(${scale})` }}
              title={t('previewTitle')}
            />
          </div>
        ) : (
          <p className="m-0 p-8 text-center text-sm text-[var(--muted)]">{t('noPageToPreview')}</p>
        )}
      </div>
    </section>
  );
}
