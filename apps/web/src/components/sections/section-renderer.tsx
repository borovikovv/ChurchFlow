import type { CSSProperties, ReactNode } from 'react';
import { readText, type PublicSection, type PublicWebsiteSummary } from './types';

export type { PublicSection, PublicWebsiteSummary } from './types';

type PublicThemeStyle = CSSProperties & {
  '--public-accent'?: string;
  '--public-background'?: string;
};

function PublicSectionShell({
  children,
  tone = 'light',
}: {
  children: ReactNode;
  tone?: 'light' | 'muted' | 'accent';
}) {
  const toneClassName = {
    light: 'bg-[var(--public-background)] text-[#1f2328]',
    muted: 'bg-[#f6f8fa] text-[#1f2328]',
    accent: 'bg-[var(--public-accent)] text-white',
  }[tone];

  return (
    <section className={toneClassName}>
      <div className="mx-auto grid w-full max-w-6xl gap-4 px-5 py-12 sm:px-8 sm:py-16">
        {children}
      </div>
    </section>
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
    <PublicSectionShell tone="accent">
      <p className="m-0 text-sm font-bold uppercase tracking-[0.08em] opacity-80">
        {website?.organization?.name ?? website?.title}
      </p>
      <h1 className="m-0 max-w-3xl text-4xl font-bold leading-tight sm:text-6xl">
        {readText(content, 'headline', website?.title ?? 'Welcome')}
      </h1>
      <p className="m-0 max-w-2xl text-lg leading-8 opacity-90">
        {readText(content, 'subheading', website?.description ?? '')}
      </p>
    </PublicSectionShell>
  );
}

function AboutSection({ content }: { content: Record<string, unknown> }) {
  return (
    <PublicSectionShell>
      <SectionHeading title={readText(content, 'title', 'About')} />
      <PublicParagraph>{readText(content, 'body')}</PublicParagraph>
    </PublicSectionShell>
  );
}

function ScheduleSection({ content }: { content: Record<string, unknown> }) {
  return (
    <PublicSectionShell tone="muted">
      <SectionHeading title={readText(content, 'title', 'Schedule')} />
      <PublicParagraph>{readText(content, 'body')}</PublicParagraph>
    </PublicSectionShell>
  );
}

function GallerySection({ content }: { content: Record<string, unknown> }) {
  return (
    <PublicSectionShell>
      <SectionHeading title={readText(content, 'title', 'Gallery')} />
      <PublicParagraph>{readText(content, 'body')}</PublicParagraph>
    </PublicSectionShell>
  );
}

function ContactSection({ content }: { content: Record<string, unknown> }) {
  return (
    <PublicSectionShell tone="muted">
      <SectionHeading title={readText(content, 'title', 'Contact')} />
      <div className="grid gap-2 text-lg">
        <PublicParagraph>{readText(content, 'body')}</PublicParagraph>
        {readText(content, 'address') ? (
          <p className="m-0">{readText(content, 'address')}</p>
        ) : null}
        {readText(content, 'email') ? <p className="m-0">{readText(content, 'email')}</p> : null}
        {readText(content, 'phone') ? <p className="m-0">{readText(content, 'phone')}</p> : null}
      </div>
    </PublicSectionShell>
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

function readTheme(theme: Record<string, unknown>, key: string, fallback: string): string {
  const value = theme[key];

  return typeof value === 'string' && value.trim() ? value : fallback;
}
