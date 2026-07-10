import type { CSSProperties, ReactNode } from 'react';
import { Montserrat } from 'next/font/google';
import { readText, type PublicSection, type PublicWebsiteSummary } from './types';

export type { PublicSection, PublicWebsiteSummary } from './types';

const montserrat = Montserrat({
  subsets: ['latin', 'cyrillic'],
  weight: ['600', '700', '900'],
  display: 'swap',
});

const socialLinks = [
  { key: 'socialMetaHref', label: 'Meta', icon: '/icons/socials/meta.svg' },
  { key: 'socialInstagramHref', label: 'Instagram', icon: '/icons/socials/insta.svg' },
  { key: 'socialTiktokHref', label: 'TikTok', icon: '/icons/socials/tiktok.svg' },
  { key: 'socialXHref', label: 'X', icon: '/icons/socials/x.svg' },
] as const;

type PublicThemeStyle = CSSProperties & {
  '--public-accent'?: string;
  '--public-background'?: string;
};

function PublicSectionShell({
  children,
  content,
  tone = 'light',
}: {
  children: ReactNode;
  content?: Record<string, unknown> | undefined;
  tone?: 'light' | 'muted' | 'accent';
}) {
  const toneClassName = {
    light: 'bg-[var(--public-background)] text-[#1f2328]',
    muted: 'bg-[#f6f8fa] text-[#1f2328]',
    accent: 'bg-[var(--public-accent)] text-white',
  }[tone];
  const fontClassName = sectionFontClassName(content);
  const frameClassName = sectionFrameClassName(content);

  return (
    <section
      className={`${toneClassName} ${fontClassName} ${frameClassName}`}
      style={sectionBackgroundStyle(content)}
    >
      <div className="mx-auto grid w-full max-w-6xl gap-4 px-5 py-12 sm:px-8 sm:py-16">
        {children}
      </div>
    </section>
  );
}

function ButtonRow({ content }: { content: Record<string, unknown> }) {
  const primaryLabel = readText(content, 'primaryLabel');
  const primaryHref = readText(content, 'primaryHref', '#');
  const secondaryLabel = readText(content, 'secondaryLabel');
  const secondaryHref = readText(content, 'secondaryHref', '#');

  if (!primaryLabel && !secondaryLabel) return null;

  return (
    <div className="flex flex-wrap gap-3">
      {primaryLabel ? (
        <a
          className="inline-flex min-h-11 items-center rounded-md bg-[#1f2328] px-5 font-bold text-white no-underline"
          href={primaryHref}
        >
          {primaryLabel}
        </a>
      ) : null}
      {secondaryLabel ? (
        <a
          className="inline-flex min-h-11 items-center rounded-md border border-current px-5 font-bold text-current no-underline"
          href={secondaryHref}
        >
          {secondaryLabel}
        </a>
      ) : null}
    </div>
  );
}

function HeroSection({
  content,
  website,
}: {
  content: Record<string, unknown>;
  website?: PublicWebsiteSummary | undefined;
}) {
  return (
    <PublicSectionShell content={content} tone="accent">
      <p className="m-0 text-sm font-bold uppercase text-white tracking-[0.08em] opacity-80">
        {website?.title}
      </p>
      <h1 className="m-0 max-w-3xl text-4xl font-bold leading-tight text-white sm:text-6xl">
        {readText(content, 'headline', website?.title ?? '')}
      </h1>
      <p className="m-0 max-w-2xl text-lg leading-8 text-white opacity-90">
        {readText(content, 'subheading', website?.description ?? '')}
      </p>
      <ButtonRow content={content} />
    </PublicSectionShell>
  );
}

function AboutSection({ content }: { content: Record<string, unknown> }) {
  return (
    <PublicSectionShell content={content}>
      <SectionHeading title={readText(content, 'title', 'About')} />
      <PublicParagraph>{readText(content, 'body')}</PublicParagraph>
      <ButtonRow content={content} />
    </PublicSectionShell>
  );
}

function ScheduleSection({ content }: { content: Record<string, unknown> }) {
  return (
    <PublicSectionShell content={content} tone="muted">
      <SectionHeading title={readText(content, 'title', 'Schedule')} />
      <PublicParagraph>{readText(content, 'body')}</PublicParagraph>
      <ButtonRow content={content} />
    </PublicSectionShell>
  );
}

function GallerySection({ content }: { content: Record<string, unknown> }) {
  return (
    <PublicSectionShell content={content}>
      <SectionHeading title={readText(content, 'title', 'Gallery')} />
      <PublicParagraph>{readText(content, 'body')}</PublicParagraph>
      <CardGrid items={readItems(content)} />
      <ButtonRow content={content} />
    </PublicSectionShell>
  );
}

function ContactSection({ content }: { content: Record<string, unknown> }) {
  return (
    <PublicSectionShell content={content} tone="muted">
      <SectionHeading title={readText(content, 'title', 'Contact')} />
      <div className="grid gap-2 text-lg">
        <PublicParagraph>{readText(content, 'body')}</PublicParagraph>
        {readText(content, 'address') ? (
          <p className="m-0">{readText(content, 'address')}</p>
        ) : null}
        {readText(content, 'email') ? <p className="m-0">{readText(content, 'email')}</p> : null}
        {readText(content, 'phone') ? <p className="m-0">{readText(content, 'phone')}</p> : null}
      </div>
      <ButtonRow content={content} />
    </PublicSectionShell>
  );
}

function QuickLinksSection({ content }: { content: Record<string, unknown> }) {
  const fontClassName = sectionFontClassName(content);
  const frameClassName = sectionFrameClassName(content);

  return (
    <section
      className={`bg-[#1f2328] text-white ${fontClassName} ${frameClassName}`}
      style={sectionBackgroundStyle(content)}
    >
      <nav
        aria-label="Featured links"
        className="mx-auto grid w-full max-w-6xl gap-2 px-5 py-5 sm:grid-cols-3 sm:px-8"
      >
        {readItems(content).map((item) => (
          <a
            className="rounded-md border border-white/20 px-4 py-3 text-center font-bold text-white no-underline hover:bg-white/10"
            href={item.href || '#'}
            key={item.title}
          >
            {item.title}
          </a>
        ))}
      </nav>
    </section>
  );
}

function SundaySection({ content }: { content: Record<string, unknown> }) {
  return (
    <PublicSectionShell content={content} tone="muted">
      <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr] lg:items-center">
        <SectionHeading title={readText(content, 'title', 'Join us this Sunday')} />
        <div className="grid gap-4">
          <PublicParagraph>{readText(content, 'body')}</PublicParagraph>
          <ButtonRow content={content} />
        </div>
      </div>
    </PublicSectionShell>
  );
}

function CardsSection({ content }: { content: Record<string, unknown> }) {
  return (
    <PublicSectionShell content={content}>
      <SectionHeaderWithAction content={content} fallbackTitle="Get connected" />
      <CardGrid items={readItems(content)} />
    </PublicSectionShell>
  );
}

function EventsSection({ content }: { content: Record<string, unknown> }) {
  return (
    <PublicSectionShell content={content} tone="muted">
      <SectionHeaderWithAction content={content} fallbackTitle="What's happening" />
      <CardGrid items={readItems(content)} compact />
    </PublicSectionShell>
  );
}

function HighlightSection({ content }: { content: Record<string, unknown> }) {
  return (
    <PublicSectionShell content={content} tone="accent">
      <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
        <div className="grid gap-3">
          <SectionHeading title={readText(content, 'title', 'Take a next step')} />
          <p className="m-0 max-w-3xl text-lg leading-8 opacity-90">{readText(content, 'body')}</p>
        </div>
        <ButtonRow content={content} />
      </div>
    </PublicSectionShell>
  );
}

function FooterSection({
  content,
  website,
}: {
  content: Record<string, unknown>;
  website?: PublicWebsiteSummary | undefined;
}) {
  const fontClassName = sectionFontClassName(content);
  const frameClassName = sectionFrameClassName(content);

  return (
    <footer
      className={`bg-[#1f2328] text-white ${fontClassName} ${frameClassName}`}
      style={sectionBackgroundStyle(content)}
    >
      <div className="mx-auto text-white/70 grid w-full max-w-6xl gap-6 px-5 py-10 sm:px-8 lg:grid-cols-[1fr_1fr]">
        <div className="grid gap-2">
          {readText(content, 'address') ? <span>{readText(content, 'address')}</span> : null}
          {readText(content, 'email') ? <span>{readText(content, 'email')}</span> : null}
          {readText(content, 'phone') ? <span>{readText(content, 'phone')}</span> : null}
        </div>
        <div className="grid gap-4 lg:justify-items-end">
          <ButtonRow content={content} />
          <FooterSocialLinks content={content} />
          <span className="text-sm text-white/70 self-end">
            {readText(content, 'copyright', `© 2026 ${website?.title ?? 'Church'}`)}
          </span>
        </div>
      </div>
    </footer>
  );
}

function FooterSocialLinks({ content }: { content: Record<string, unknown> }) {
  const links = socialLinks
    .map((link) => ({ ...link, href: readText(content, link.key) }))
    .filter((link) => link.href);

  if (links.length === 0) return null;

  return (
    <nav aria-label="Social links" className="flex gap-5 flex-wrap md:justify-around text-white/70">
      {links.map((link) => (
        <a
          aria-label={link.label}
          className="inline-grid size-6 place-items-center text-current no-underline transition-opacity hover:opacity-80"
          href={link.href}
          key={link.key}
          rel="noreferrer"
          target="_blank"
        >
          <span
            aria-hidden="true"
            className="block size-5 bg-current"
            style={{
              WebkitMask: `url(${link.icon}) center / contain no-repeat`,
              mask: `url(${link.icon}) center / contain no-repeat`,
            }}
          />
        </a>
      ))}
    </nav>
  );
}

function SectionHeaderWithAction({
  content,
  fallbackTitle,
}: {
  content: Record<string, unknown>;
  fallbackTitle: string;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="grid gap-3">
        <SectionHeading title={readText(content, 'title', fallbackTitle)} />
        <PublicParagraph>{readText(content, 'body')}</PublicParagraph>
      </div>
      <ButtonRow content={content} />
    </div>
  );
}

function CardGrid({ compact = false, items }: { compact?: boolean; items: PublicItem[] }) {
  if (items.length === 0) return null;

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {items.map((item) => (
        <a
          className="grid gap-2 rounded-md border border-[#d0d7de] bg-white p-5 text-[#1f2328] no-underline shadow-sm"
          href={item.href || '#'}
          key={`${item.title}:${item.href}`}
        >
          <strong className={compact ? 'text-base' : 'text-xl'}>{item.title}</strong>
          {item.body ? <span className="text-sm leading-6 text-[#57606a]">{item.body}</span> : null}
          {item.label ? (
            <span className="text-sm font-bold text-[var(--public-accent)]">{item.label}</span>
          ) : null}
        </a>
      ))}
    </div>
  );
}

function SectionHeading({ title }: { title: string }) {
  return <h2 className="m-0 text-3xl font-bold leading-tight sm:text-4xl">{title}</h2>;
}

function PublicParagraph({ children }: { children: ReactNode }) {
  if (!children) return null;

  return <p className="m-0 max-w-3xl text-lg leading-8 text-[#57606a]">{children}</p>;
}

export function SectionRenderer({
  sections,
  website,
}: {
  sections: PublicSection[];
  website?: PublicWebsiteSummary | undefined;
}) {
  const theme = website?.theme ?? {};
  const renderedSections =
    sections.length > 0
      ? sections
      : [
          {
            id: 'default-hero',
            type: 'hero' as const,
            order: 0,
            content: {
              headline: website?.title ?? 'Welcome',
              subheading: website?.description ?? '',
            },
          },
        ];
  const style: PublicThemeStyle = {
    '--public-accent': readTheme(theme, 'accent', '#1f883d'),
    '--public-background': readTheme(theme, 'background', '#ffffff'),
  };

  return (
    <div className="min-h-screen bg-[var(--public-background)]" style={style}>
      {renderedSections.map((section) => {
        const props = { content: section.content };
        const variant = readText(section.content, 'variant');
        if (variant === 'quick-links') return <QuickLinksSection key={section.id} {...props} />;
        if (variant === 'sunday') return <SundaySection key={section.id} {...props} />;
        if (variant === 'connect' || variant === 'sermons') {
          return <CardsSection key={section.id} {...props} />;
        }
        if (variant === 'events') return <EventsSection key={section.id} {...props} />;
        if (['newsletter', 'app', 'cta'].includes(variant)) {
          return <HighlightSection key={section.id} {...props} />;
        }
        if (variant === 'footer') {
          return <FooterSection key={section.id} {...props} website={website} />;
        }

        switch (section.type) {
          case 'hero':
            return <HeroSection key={section.id} {...props} website={website} />;
          case 'about':
            return <AboutSection key={section.id} {...props} />;
          case 'schedule':
            return <ScheduleSection key={section.id} {...props} />;
          case 'gallery':
            return <GallerySection key={section.id} {...props} />;
          case 'contact':
            return <ContactSection key={section.id} {...props} />;
        }
      })}
    </div>
  );
}

interface PublicItem {
  body: string;
  href: string;
  label: string;
  title: string;
}

function readTheme(theme: Record<string, unknown>, key: string, fallback: string): string {
  const value = theme[key];

  return typeof value === 'string' && value.trim() ? value : fallback;
}

function sectionBackgroundStyle(content?: Record<string, unknown> | undefined): CSSProperties {
  if (!content) return {};

  const backgroundColor = readText(content, 'backgroundColor');
  const backgroundImageUrl = readText(content, 'backgroundImageUrl');
  const style: CSSProperties = {};

  if (backgroundColor) {
    style.backgroundColor = backgroundColor;
  }

  if (backgroundImageUrl) {
    style.backgroundImage = `url(${backgroundImageUrl})`;
    style.backgroundPosition = 'center';
    style.backgroundRepeat = 'no-repeat';
    style.backgroundSize = 'cover';
  }

  return style;
}

function sectionFontClassName(content?: Record<string, unknown> | undefined): string {
  const fontPreset = content ? readText(content, 'fontPreset', 'default') : 'default';

  if (fontPreset === 'montserrat-body') {
    return `${montserrat.className} [&_a]:font-semibold [&_p]:font-semibold [&_span]:font-semibold`;
  }

  if (fontPreset === 'montserrat-heading') {
    return `${montserrat.className} [&_h1]:font-black [&_h2]:font-black [&_h3]:font-black [&_strong]:font-black`;
  }

  return '';
}

function sectionFrameClassName(content?: Record<string, unknown> | undefined): string {
  if (!content) return '';

  const hasBackground =
    Boolean(readText(content, 'backgroundColor')) ||
    Boolean(readText(content, 'backgroundImageUrl'));

  if (!hasBackground) return '';

  return 'mx-[30px] mt-[30px] overflow-hidden rounded-[10px] shadow-[0px_4px_8px_0px_rgba(0,0,0,0.17)]';
}

function readItems(content: Record<string, unknown>): PublicItem[] {
  const value = content['items'];
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (typeof item !== 'object' || item === null) return [];
    const record = item as Record<string, unknown>;
    const title = typeof record['title'] === 'string' ? record['title'] : '';
    if (!title) return [];

    return [
      {
        body: typeof record['body'] === 'string' ? record['body'] : '',
        href: typeof record['href'] === 'string' ? record['href'] : '',
        label: typeof record['label'] === 'string' ? record['label'] : '',
        title,
      },
    ];
  });
}
