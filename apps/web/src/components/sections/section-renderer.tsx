import { readText, type PublicSection } from './types';

export type { PublicSection } from './types';

function HeroSection({ content }: { content: Record<string, unknown> }) {
  return (
    <section className="section">
      <div className="shell stack">
        <h1>{readText(content, 'headline', 'Welcome')}</h1>
        <p>{readText(content, 'subheading')}</p>
      </div>
    </section>
  );
}

function AboutSection({ content }: { content: Record<string, unknown> }) {
  return (
    <section className="section">
      <div className="shell stack">
        <h2>{readText(content, 'title', 'About')}</h2>
        <p>{readText(content, 'body')}</p>
      </div>
    </section>
  );
}

function ScheduleSection({ content }: { content: Record<string, unknown> }) {
  return (
    <section className="section">
      <div className="shell stack">
        <h2>{readText(content, 'title', 'Schedule')}</h2>
        <p>{readText(content, 'body')}</p>
      </div>
    </section>
  );
}

function GallerySection({ content }: { content: Record<string, unknown> }) {
  return (
    <section className="section">
      <div className="shell stack">
        <h2>{readText(content, 'title', 'Gallery')}</h2>
        <p>{readText(content, 'body')}</p>
      </div>
    </section>
  );
}

function ContactSection({ content }: { content: Record<string, unknown> }) {
  return (
    <section className="section">
      <div className="shell stack">
        <h2>{readText(content, 'title', 'Contact')}</h2>
        <p>{readText(content, 'body')}</p>
      </div>
    </section>
  );
}

export function SectionRenderer({ sections }: { sections: PublicSection[] }) {
  return sections.map((section) => {
    const props = { key: section.id, content: section.content };
    switch (section.type) {
      case 'hero':
        return <HeroSection {...props} />;
      case 'about':
        return <AboutSection {...props} />;
      case 'schedule':
        return <ScheduleSection {...props} />;
      case 'gallery':
        return <GallerySection {...props} />;
      case 'contact':
        return <ContactSection {...props} />;
    }
  });
}
