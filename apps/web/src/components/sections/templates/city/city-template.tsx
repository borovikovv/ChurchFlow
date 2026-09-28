import { montserrat } from '../../fonts';
import type { PublicSection, PublicWebsiteSummary } from '../../types';
import { CityAbout } from './city-about';
import { CityContact } from './city-contact';
import { CityFooter } from './city-footer';
import { CityGiving } from './city-giving';
import { CityHeader } from './city-header';
import { CityHero } from './city-hero';
import { CityLive } from './city-live';
import { CityLocation } from './city-location';
import { cityTheme } from './city-shared';

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
      {!hasHero ? <CityHeader standalone website={website} /> : null}
      {sections.map((section) => {
        const props = { content: section.content, theme, website };

        switch (section.type) {
          case 'hero':
            return <CityHero key={section.id} {...props} />;
          case 'about':
            return <CityAbout key={section.id} {...props} />;
          case 'live':
            return <CityLive key={section.id} {...props} />;
          case 'schedule':
            return <CityLocation key={section.id} {...props} />;
          case 'giving':
            return <CityGiving key={section.id} {...props} />;
          case 'contact':
            return <CityContact key={section.id} {...props} />;
          case 'footer':
            return <CityFooter content={section.content} key={section.id} website={website} />;
          default:
            return null;
        }
      })}
    </div>
  );
}
