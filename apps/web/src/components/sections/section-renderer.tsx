import type { PublicSection, PublicWebsiteSummary } from './types';
import { CityTemplate } from './templates/city/city-template';
import { DefaultTemplate } from './templates/default/default-template';

export type { PublicSection, PublicWebsiteSettings, PublicWebsiteSummary } from './types';

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
