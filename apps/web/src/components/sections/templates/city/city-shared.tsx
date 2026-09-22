import Image from 'next/image';
import type { CSSProperties, ReactNode } from 'react';
import { readText, type PublicWebsiteSummary } from '../../types';
import { resolveWebsiteHref, type CityTheme } from './city-format';

export {
  cityMessages,
  cityTheme,
  formatNextService,
  formatServiceTime,
  readCityItems,
  resolveWebsiteHref,
  type CityItem,
  type CityMessages,
  type CityTheme,
} from './city-format';

export function CityButton({
  children,
  href,
  style,
  tone,
}: {
  children: ReactNode;
  href: string;
  style?: CSSProperties | undefined;
  tone: 'accent' | 'outline-light' | 'outline-dark';
}) {
  const toneClassName = {
    accent: '',
    'outline-light': 'border border-white/70 text-white',
    'outline-dark': 'border border-[#0a0a0a] text-[#0a0a0a]',
  }[tone];

  return (
    <a
      className={`inline-flex min-h-[52px] items-center justify-center gap-2 rounded-[2px] px-7 text-[13px] font-bold uppercase tracking-[0.14em] no-underline transition-[filter] hover:brightness-90 hover:no-underline ${toneClassName}`}
      href={href || '#'}
      style={style}
    >
      {children}
    </a>
  );
}

export function CityButtons({
  content,
  theme,
  onDark,
  website,
}: {
  content: Record<string, unknown>;
  theme: CityTheme;
  onDark: boolean;
  website: PublicWebsiteSummary | undefined;
}) {
  const primaryLabel = readText(content, 'primaryLabel');
  const secondaryLabel = readText(content, 'secondaryLabel');
  if (!primaryLabel && !secondaryLabel) return null;

  const accentStyle = onDark
    ? { background: theme.accent, color: theme.onAccent }
    : { background: theme.accentInk, color: theme.onAccentInk };

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
      {primaryLabel ? (
        <CityButton
          href={resolveWebsiteHref(readText(content, 'primaryHref'), website)}
          style={accentStyle}
          tone="accent"
        >
          {primaryLabel}
        </CityButton>
      ) : null}
      {secondaryLabel ? (
        <CityButton
          href={resolveWebsiteHref(readText(content, 'secondaryHref'), website)}
          tone={onDark ? 'outline-light' : 'outline-dark'}
        >
          {secondaryLabel}
        </CityButton>
      ) : null}
    </div>
  );
}

export function CityEyebrow({
  children,
  className = '',
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties | undefined;
}) {
  return (
    <p
      className={`m-0 text-[12px] font-bold uppercase tracking-[0.2em] ${className}`}
      style={style}
    >
      {children}
    </p>
  );
}

export function CityHeading({
  children,
  className = '',
  level = 2,
}: {
  children: ReactNode;
  className?: string;
  level?: 1 | 2;
}) {
  const shared = `m-0 font-extrabold uppercase leading-[1.02] tracking-[-0.02em] ${className}`;

  if (level === 1) {
    return (
      <h1
        className={`${shared} text-[44px] font-black leading-[0.96] sm:text-[64px] lg:text-[88px]`}
      >
        {children}
      </h1>
    );
  }

  return <h2 className={`${shared} text-[32px] sm:text-[48px]`}>{children}</h2>;
}

/**
 * A cover host paints the dark base colour and owns the stacking context the background image and
 * its overlay sit in, so the section content stays above them without a wrapper of its own.
 */
export const CITY_COVER_CLASS = 'relative isolate bg-[#1a1a1a]';

/** An empty background slot keeps its grey plate and stays out of the accessibility tree. */
export const CITY_IMAGE_PLATE_CLASS = 'relative isolate bg-[#e9e9e9]';

export function CityBackgroundImage({
  content,
  overlay = false,
  priority = false,
}: {
  content: Record<string, unknown>;
  overlay?: boolean;
  priority?: boolean;
}) {
  const imageUrl = readText(content, 'backgroundImageUrl');
  if (!imageUrl) return null;

  const alt = readText(content, 'backgroundImageAlt');

  return (
    <>
      <Image
        alt={alt}
        aria-hidden={alt ? undefined : true}
        className="-z-10 object-cover"
        fill
        priority={priority}
        src={imageUrl}
        // Media urls are signed per request and expire, so they cannot pass the image optimizer.
        // That costs the srcset entirely: no resizing, no format conversion, and next/image drops
        // `sizes` for an unoptimized source, so setting it would be dead weight. What is left is
        // still worth it: real alt text, lazy loading below the fold and the hero preload.
        unoptimized
      />
      {overlay ? <span aria-hidden="true" className="absolute inset-0 -z-10 bg-black/50" /> : null}
    </>
  );
}
