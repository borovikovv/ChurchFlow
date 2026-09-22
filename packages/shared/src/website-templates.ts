import { WEBSITE_PAGE_PRESETS } from './constants.js';
import type { PUBLIC_SECTION_TYPES, WEBSITE_TEMPLATES } from './constants.js';

export type WebsiteTemplateId = (typeof WEBSITE_TEMPLATES)[number];
export type WebsiteSectionType = (typeof PUBLIC_SECTION_TYPES)[number];
export type WebsitePagePreset = (typeof WEBSITE_PAGE_PRESETS)[number];

export interface WebsiteTemplateSectionDefinition {
  type: WebsiteSectionType;
  variant: string;
  content: Record<string, unknown>;
}

export interface WebsiteTemplateDefinition {
  id: WebsiteTemplateId;
  theme: { accent: string; background: string };
  sectionTypes: readonly WebsiteSectionType[];
  home: readonly WebsiteTemplateSectionDefinition[];
  /** Default content for variants the home page does not use. */
  variants: readonly WebsiteTemplateSectionDefinition[];
  /** Starter sections offered when an owner creates an inner page. */
  pages: Readonly<Partial<Record<WebsitePagePreset, readonly WebsiteTemplateSectionDefinition[]>>>;
}

const DEFAULT_TEMPLATE: WebsiteTemplateDefinition = {
  id: 'default',
  theme: { accent: '#1f883d', background: '#ffffff' },
  sectionTypes: ['hero', 'about', 'schedule', 'gallery', 'contact'],
  home: [
    {
      type: 'hero',
      variant: 'hero',
      content: {
        headline: 'Welcome to our church',
        subheading: 'A place to worship, grow, serve, and belong.',
        primaryLabel: 'Plan a visit',
        primaryHref: '#visit',
        secondaryLabel: 'Watch online',
        secondaryHref: '#',
      },
    },
    {
      type: 'contact',
      variant: 'contact',
      content: {
        title: 'Contact us',
        body: 'We would love to hear from you.',
        email: 'hello@example.com',
        phone: '(555) 000-0000',
        address: '123 Church Street',
      },
    },
    {
      type: 'contact',
      variant: 'footer',
      content: {
        title: 'Church name',
        address: '123 Church Street',
        email: 'hello@example.com',
        phone: '(555) 000-0000',
        copyright: '© 2026 Church name',
        primaryLabel: 'Give',
        primaryHref: '#give',
      },
    },
  ],
  variants: [],
  pages: {},
};

const CITY_ABOUT_TEXT: WebsiteTemplateSectionDefinition = {
  type: 'about',
  variant: 'text',
  content: {
    eyebrow: 'Who we are',
    title: 'A church for this city',
    body: 'We are a community of people who follow Jesus together. We gather every week to worship, to learn from the Bible and to serve the neighbourhood we live in.',
    primaryLabel: 'Plan a visit',
    primaryHref: '#location',
  },
};

const CITY_ABOUT_COLUMNS: WebsiteTemplateSectionDefinition = {
  type: 'about',
  variant: 'columns',
  content: {
    eyebrow: 'What we believe',
    title: 'What holds us together',
    items: [
      { title: 'The Bible', body: 'We read it together and let it shape how we live.' },
      { title: 'Community', body: 'Small groups where nobody stays a stranger.' },
      { title: 'The city', body: 'We serve our neighbours, not only ourselves.' },
    ],
  },
};

const CITY_CONTACT_DETAILS: WebsiteTemplateSectionDefinition = {
  type: 'contact',
  variant: 'details',
  content: {
    title: 'Get in touch',
    body: 'Write to us, call us, or simply come by on Sunday. We answer every message.',
    primaryLabel: 'Get directions',
  },
};

const CITY_GIVING_WAYS: WebsiteTemplateSectionDefinition = {
  type: 'giving',
  variant: 'ways',
  content: {
    eyebrow: 'Giving',
    title: 'Ways to give',
    body: 'Every gift supports the ministries and the building we share with our neighbourhood.',
    ways: [
      { label: 'By card', value: 'One-off or monthly, through our online form' },
      { label: 'Bank transfer', value: 'Ask us for the account details' },
      { label: 'In person', value: 'The box by the entrance, any Sunday' },
    ],
    primaryLabel: 'Give online',
    primaryHref: '#',
  },
};

const CITY_FOOTER_COLUMNS: WebsiteTemplateSectionDefinition = {
  type: 'footer',
  variant: 'columns',
  content: {
    copyright: '© 2026 Church name',
  },
};

const CITY_TEMPLATE: WebsiteTemplateDefinition = {
  id: 'city',
  theme: { accent: '#ffffff', background: '#ffffff' },
  sectionTypes: ['hero', 'about', 'live', 'schedule', 'giving', 'contact', 'footer'],
  home: [
    {
      type: 'hero',
      variant: 'cover',
      content: {
        headline: 'You are welcome here',
        subheading:
          'A church that loves God, people and the city. Come as you are — there is already a place for you.',
        primaryLabel: 'Plan a visit',
        primaryHref: '#location',
        secondaryLabel: 'Watch online',
        secondaryHref: '#live',
      },
    },
    {
      type: 'live',
      variant: 'banner',
      content: {
        liveLabel: 'Live now',
        liveTitle: 'Sunday service',
        scheduledTitle: 'Next stream',
        scheduledBody:
          'The stream starts a few minutes before the service. The recording is available the same day.',
        primaryLabel: 'Join',
        secondaryLabel: 'Remind me',
      },
    },
    {
      type: 'schedule',
      variant: 'location',
      content: {
        title: 'How to find us',
        primaryLabel: 'Get directions',
        secondaryLabel: 'Contact us',
        secondaryHref: '#footer',
      },
    },
    {
      type: 'giving',
      variant: 'cover',
      content: {
        title: 'Generosity changes the city',
        body: 'Every gift supports the ministries and the building we share with our neighbourhood.',
        primaryLabel: 'Give online',
        primaryHref: '#',
        secondaryLabel: 'Bank details',
        secondaryHref: '#',
      },
    },
    CITY_FOOTER_COLUMNS,
  ],
  variants: [
    {
      type: 'hero',
      variant: 'split',
      content: {
        headline: 'Come as you are',
        subheading:
          'A church in the middle of the city, for the people of the city. Sunday is a good day to start.',
        primaryLabel: 'Plan a visit',
        primaryHref: '#location',
      },
    },
    CITY_ABOUT_TEXT,
    CITY_ABOUT_COLUMNS,
    CITY_CONTACT_DETAILS,
    CITY_GIVING_WAYS,
  ],
  pages: {
    about: [CITY_ABOUT_TEXT, CITY_ABOUT_COLUMNS, CITY_FOOTER_COLUMNS],
    contacts: [CITY_CONTACT_DETAILS, CITY_FOOTER_COLUMNS],
    giving: [CITY_GIVING_WAYS, CITY_FOOTER_COLUMNS],
  },
};

export const WEBSITE_TEMPLATE_DEFINITIONS: Record<WebsiteTemplateId, WebsiteTemplateDefinition> = {
  default: DEFAULT_TEMPLATE,
  city: CITY_TEMPLATE,
};

export function websiteTemplate(id: WebsiteTemplateId): WebsiteTemplateDefinition {
  return WEBSITE_TEMPLATE_DEFINITIONS[id];
}

/** Default content for a variant, whether the home page uses it or not. */
export function websiteTemplateVariantContent(
  id: WebsiteTemplateId,
  type: WebsiteSectionType,
  variant: string,
): Record<string, unknown> | undefined {
  const template = websiteTemplate(id);
  const definition = [...template.home, ...template.variants].find(
    (section) => section.type === type && section.variant === variant,
  );

  return definition?.content;
}

/** The presets a template offers, in the order they should be listed. */
export function websiteTemplatePagePresets(id: WebsiteTemplateId): WebsitePagePreset[] {
  const { pages } = websiteTemplate(id);

  return WEBSITE_PAGE_PRESETS.filter((preset) => (pages[preset]?.length ?? 0) > 0);
}

/** Starter sections for a preset; empty when the template does not define it. */
export function websiteTemplatePageSections(
  id: WebsiteTemplateId,
  preset: WebsitePagePreset,
): readonly WebsiteTemplateSectionDefinition[] {
  return websiteTemplate(id).pages[preset] ?? [];
}
