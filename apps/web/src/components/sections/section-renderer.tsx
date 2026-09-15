import type { PublicSection, PublicWebsiteSummary } from './types';
import { CityTemplate } from './templates/city/city-template';
import { DefaultTemplate } from './templates/default/default-template';

export type { PublicSection, PublicWebsiteSettings, PublicWebsiteSummary } from './types';

// The template id on the website decides which renderer draws its sections. Websites created
// before templates existed have no id and keep rendering exactly as they did.
export function SectionRenderer({
  sections,
  website,
}: {
  sections: PublicSection[];
  website?: PublicWebsiteSummary | undefined;
}) {
  if (website?.settings?.template === 'city') {
    return <CityTemplate sections={sections} website={website} />;
  }

  return <DefaultTemplate sections={sections} website={website} />;
}
