import { readText, type PublicWebsiteSummary } from '../../types';
import {
  CITY_COVER_CLASS,
  CityBackgroundImage,
  CityButton,
  CityEyebrow,
  cityMessages,
  formatNextService,
  resolveWebsiteHref,
  type CityTheme,
} from './city-shared';

export function CityLive({
  content,
  theme,
  website,
}: {
  content: Record<string, unknown>;
  theme: CityTheme;
  website: PublicWebsiteSummary | undefined;
}) {
  const live = website?.settings?.live;
  const messages = cityMessages(website);
  const url = live?.url ?? null;
  const nextService = live?.nextService ?? null;

  if (!url && !nextService) return null;

  const isLive = Boolean(live?.isLive && url);
  const liveLabel = readText(content, 'liveLabel', messages.liveNow);
  const title = isLive
    ? readText(content, 'liveTitle', nextService?.label ?? messages.liveNow)
    : readText(content, 'scheduledTitle', messages.nextStream);
  const primaryLabel = readText(content, 'primaryLabel', messages.watch);
  const secondaryLabel = readText(content, 'secondaryLabel');
  const secondaryHref = resolveWebsiteHref(
    readText(content, 'secondaryHref') || url || '',
    website,
  );

  return (
    <section className="px-5 py-14 lg:py-[104px]" id="live">
      <div className="mx-auto grid w-full max-w-[1240px] bg-[#0a0a0a] text-white lg:grid-cols-[7fr_5fr]">
        <a
          aria-label={primaryLabel}
          className={`block aspect-video no-underline hover:no-underline ${CITY_COVER_CLASS}`}
          href={url ?? secondaryHref}
          rel="noreferrer"
          target="_blank"
        >
          <CityBackgroundImage content={content} overlay sizes="(min-width: 1024px) 720px, 100vw" />
          <span className="absolute left-1/2 top-1/2 inline-flex size-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white">
            <svg aria-hidden="true" fill="#0a0a0a" height="20" viewBox="0 0 24 24" width="20">
              <polygon points="8 5 19 12 8 19 8 5" />
            </svg>
          </span>
          {isLive ? (
            <span className="absolute left-4 top-4 inline-flex h-7 items-center gap-2 bg-[#e0272b] px-3 text-[11px] font-extrabold uppercase tracking-[0.16em] text-white">
              <span aria-hidden="true" className="inline-block size-2 rounded-full bg-white" />
              {liveLabel}
            </span>
          ) : null}
        </a>
        <div className="flex flex-col justify-center gap-4 p-6 sm:gap-5 lg:p-12">
          <CityEyebrow className={isLive ? 'text-[#e0272b]' : 'text-[#9a9a9a]'}>
            {isLive ? liveLabel : messages.nextStream}
          </CityEyebrow>
          <h2 className="m-0 text-[24px] font-extrabold uppercase leading-[1.02] tracking-[-0.02em] sm:text-[36px]">
            {title}
          </h2>
          {!isLive && nextService ? (
            <p className="m-0 text-[14px] leading-[1.5] text-[#9a9a9a]">
              {formatNextService(nextService, website)}
              {readText(content, 'scheduledBody') ? ` · ${readText(content, 'scheduledBody')}` : ''}
            </p>
          ) : null}
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            {url ? (
              <CityButton
                href={url}
                style={{ background: theme.accent, color: theme.onAccent }}
                tone="accent"
              >
                {primaryLabel}
              </CityButton>
            ) : null}
            {secondaryLabel && secondaryHref ? (
              <CityButton href={secondaryHref} tone="outline-light">
                {secondaryLabel}
              </CityButton>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
