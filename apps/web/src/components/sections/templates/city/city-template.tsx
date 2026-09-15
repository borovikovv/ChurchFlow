import { montserrat } from '../../fonts';
import type { PublicSection, PublicWebsiteSummary } from '../../types';
import { CityFooter } from './city-footer';
import { CityGiving } from './city-giving';
import { CityHero } from './city-hero';
import { CityLive } from './city-live';
import { CityLocation } from './city-location';
import { cityTheme } from './city-shared';

// "City": full-bleed photography, one accent colour, uppercase Montserrat. Section types the
// template does not know stay stored on the page but are not drawn.
export function CityTemplate({
  sections,
  website,
}: {
  sections: PublicSection[];
  website?: PublicWebsiteSummary | undefined;
}) {
  const theme = cityTheme(website);
  const hasHero = sections.some((section) => section.type === 'hero');

  return (
    <div className={`${montserrat.className} min-h-screen bg-white text-[#0a0a0a] antialiased`}>
      {!hasHero ? (
        <CityHero
          content={{ headline: website?.title ?? '', subheading: website?.description ?? '' }}
          theme={theme}
          website={website}
        />
      ) : null}
      {sections.map((section) => {
        const props = { content: section.content, theme, website };

        switch (section.type) {
          case 'hero':
            return <CityHero key={section.id} {...props} />;
          case 'live':
            return <CityLive key={section.id} {...props} />;
          case 'schedule':
            return <CityLocation key={section.id} {...props} />;
          case 'giving':
            return <CityGiving content={section.content} key={section.id} theme={theme} />;
          case 'footer':
            return <CityFooter content={section.content} key={section.id} website={website} />;
          default:
            return null;
        }
      })}
    </div>
  );
}
