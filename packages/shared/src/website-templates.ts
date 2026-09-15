import type { PUBLIC_SECTION_TYPES, WEBSITE_TEMPLATES } from './constants.js';

export type WebsiteTemplateId = (typeof WEBSITE_TEMPLATES)[number];
export type WebsiteSectionType = (typeof PUBLIC_SECTION_TYPES)[number];

export interface WebsiteTemplateSectionDefinition {
  type: WebsiteSectionType;
  variant: string;
  content: Record<string, unknown>;
}

export interface WebsiteTemplateDefinition {
  id: WebsiteTemplateId;
  theme: { accent: string; background: string };
  // Section types this template can render; anything else on a page stays stored but hidden.
  sectionTypes: readonly WebsiteSectionType[];
  home: readonly WebsiteTemplateSectionDefinition[];
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
};

const CITY_TEMPLATE: WebsiteTemplateDefinition = {
  id: 'city',
  theme: { accent: '#ffffff', background: '#ffffff' },
  sectionTypes: ['hero', 'live', 'schedule', 'giving', 'footer'],
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
    {
      type: 'footer',
      variant: 'columns',
      content: {
        copyright: '© 2026 Church name',
      },
    },
  ],
};

export const WEBSITE_TEMPLATE_DEFINITIONS: Record<WebsiteTemplateId, WebsiteTemplateDefinition> = {
  default: DEFAULT_TEMPLATE,
  city: CITY_TEMPLATE,
};

export function websiteTemplate(id: WebsiteTemplateId): WebsiteTemplateDefinition {
  return WEBSITE_TEMPLATE_DEFINITIONS[id];
}
