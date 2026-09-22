import type { WebsiteServiceTime, WebsiteSocialLinks } from '@churchflow/shared';

// schema.org Church is a PlaceOfWorship, which is the closest published type for a congregation.
const SCHEMA_CONTEXT = 'https://schema.org';
const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

// A fixed order keeps the emitted sameAs list stable no matter how the stored settings are keyed.
const SOCIAL_KEYS = [
  'facebook',
  'instagram',
  'youtube',
  'telegram',
] as const satisfies ReadonlyArray<keyof WebsiteSocialLinks>;

const MINUTES_PER_DAY = 24 * 60;

export interface StructuredPostalAddress {
  '@type': 'PostalAddress';
  streetAddress: string;
}

export interface StructuredOpeningHours {
  '@type': 'OpeningHoursSpecification';
  dayOfWeek: string;
  opens: string;
  closes: string;
  name?: string;
}

/**
 * The published page shape this builder reads. It is narrower than `PublicPageResponse` on purpose,
 * so the builder stays a pure function with no dependency on how the page is fetched or rendered.
 */
export interface StructuredDataPage {
  seo: { noindex: boolean };
  website: {
    title: string;
    description: string | null;
    settings: {
      seo: { description: string | null; noindex: boolean };
      socials: WebsiteSocialLinks;
      location: { address?: string | undefined };
      serviceTimes: WebsiteServiceTime[];
    };
    organization: { logoUrl: string | null };
  };
}

export interface ChurchStructuredData {
  '@context': typeof SCHEMA_CONTEXT;
  '@type': 'Church';
  name: string;
  url: string;
  description?: string;
  logo?: string;
  sameAs?: string[];
  address?: StructuredPostalAddress;
  openingHoursSpecification?: StructuredOpeningHours[];
}

/**
 * The Church node for a public page, or null when the page must not be indexed. Every key the
 * website has no data for is left out, so no consumer sees an empty string or an empty list.
 */
export function churchStructuredData({
  page,
  url,
}: {
  page: StructuredDataPage;
  url: string;
}): ChurchStructuredData | null {
  const websiteSeo = page.website.settings.seo;
  if (page.seo.noindex || websiteSeo.noindex) return null;

  const description = websiteSeo.description ?? page.website.description;
  const logo = page.website.organization.logoUrl;
  const address = page.website.settings.location.address;
  const sameAs = socialUrls(page.website.settings.socials);
  const openingHours = openingHoursSpecification(page.website.settings.serviceTimes);

  return {
    '@context': SCHEMA_CONTEXT,
    '@type': 'Church',
    name: page.website.title,
    url,
    ...(description?.trim() ? { description: description.trim() } : {}),
    ...(logo?.trim() ? { logo } : {}),
    ...(sameAs.length > 0 ? { sameAs } : {}),
    ...(address?.trim()
      ? { address: { '@type': 'PostalAddress' as const, streetAddress: address.trim() } }
      : {}),
    ...(openingHours.length > 0 ? { openingHoursSpecification: openingHours } : {}),
  };
}

/**
 * JSON for a `<script type="application/ld+json">` body. `<` is escaped so no stored text can close
 * the script element early.
 */
export function structuredDataJson(data: ChurchStructuredData): string {
  return JSON.stringify(data).replace(/</gu, '\\u003c');
}

function socialUrls(socials: WebsiteSocialLinks): string[] {
  return SOCIAL_KEYS.flatMap((key) => {
    const url = socials[key];

    return typeof url === 'string' && url.trim() ? [url.trim()] : [];
  });
}

function openingHoursSpecification(serviceTimes: WebsiteServiceTime[]): StructuredOpeningHours[] {
  return serviceTimes.flatMap((service) => {
    const dayOfWeek = WEEKDAY_NAMES[service.weekday];
    const opens = minutesOfDay(service.time);
    if (!dayOfWeek || opens === null) return [];

    return [
      {
        '@type': 'OpeningHoursSpecification' as const,
        dayOfWeek,
        opens: service.time,
        closes: closingTime(opens, service.durationMinutes),
        ...(service.label?.trim() ? { name: service.label.trim() } : {}),
      },
    ];
  });
}

function minutesOfDay(time: string): number | null {
  const match = /^(?<hours>[01]\d|2[0-3]):(?<minutes>[0-5]\d)$/u.exec(time);
  if (!match?.groups) return null;

  return Number(match.groups['hours']) * 60 + Number(match.groups['minutes']);
}

// A service running past midnight is clamped to the end of its own day, because an
// OpeningHoursSpecification describes one weekday at a time.
function closingTime(opens: number, durationMinutes: number): string {
  const closes = Math.min(opens + Math.max(durationMinutes, 0), MINUTES_PER_DAY - 1);
  const hours = Math.floor(closes / 60);

  return `${String(hours).padStart(2, '0')}:${String(closes % 60).padStart(2, '0')}`;
}
