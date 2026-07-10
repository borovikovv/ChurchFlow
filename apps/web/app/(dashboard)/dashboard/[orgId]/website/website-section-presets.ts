import type { WebsiteSection } from '@churchflow/shared';
import type { JsonRecord } from './types';

export const SECTION_FIELD_GROUPS = [
  'preset',
  'font',
  'titleBody',
  'buttons',
  'items',
  'contact',
  'copyright',
  'background',
] as const;

export type SectionFieldGroup = (typeof SECTION_FIELD_GROUPS)[number];

export const SECTION_PRESETS = [
  {
    label: 'Hero',
    type: 'hero',
    variant: 'hero',
    fields: ['preset', 'font', 'titleBody', 'buttons', 'background'],
  },
  {
    label: 'Contact',
    type: 'contact',
    variant: 'contact',
    fields: ['preset', 'font', 'titleBody', 'contact', 'buttons', 'background'],
  },
  {
    label: 'Footer',
    type: 'contact',
    variant: 'footer',
    fields: ['preset', 'font', 'titleBody', 'contact', 'copyright', 'buttons', 'background'],
  },
] as const satisfies Array<{
  label: string;
  type: WebsiteSection['type'];
  variant: string;
  fields: readonly SectionFieldGroup[];
}>;

export type SectionPresetValue = (typeof SECTION_PRESETS)[number]['variant'];

export const SECTION_FONT_PRESETS = [
  { label: 'Default', value: 'default' },
  { label: 'Montserrat body', value: 'montserrat-body' },
  { label: 'Montserrat heading', value: 'montserrat-heading' },
] as const;

const SECTION_TYPE_PRESET_FALLBACKS = {
  about: 'hero',
  contact: 'contact',
  gallery: 'hero',
  hero: 'hero',
  schedule: 'hero',
} as const satisfies Record<WebsiteSection['type'], SectionPresetValue>;

export const STARTER_HOME_SECTIONS = [
  {
    type: 'hero',
    order: 0,
    content: {
      variant: 'hero',
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
    order: 1,
    content: {
      variant: 'contact',
      title: 'Contact us',
      body: 'We would love to hear from you.',
      email: 'hello@example.com',
      phone: '(555) 000-0000',
      address: '123 Church Street',
    },
  },
  {
    type: 'contact',
    order: 2,
    content: {
      variant: 'footer',
      title: 'Church name',
      address: '123 Church Street',
      email: 'hello@example.com',
      phone: '(555) 000-0000',
      copyright: '© 2026 Church name',
      primaryLabel: 'Give',
      primaryHref: '#give',
    },
  },
] as const satisfies Array<{
  type: WebsiteSection['type'];
  order: number;
  content: JsonRecord;
}>;

export function sectionPreset(value: string) {
  return SECTION_PRESETS.find((preset) => preset.variant === value) ?? SECTION_PRESETS[0];
}

export function sectionPresetValue(section: {
  type: WebsiteSection['type'];
  content: JsonRecord;
}): SectionPresetValue {
  const variant = sectionVariant(section);

  if (SECTION_PRESETS.some((preset) => preset.variant === variant)) {
    return variant as SectionPresetValue;
  }

  return SECTION_TYPE_PRESET_FALLBACKS[section.type];
}

export function sectionVariant(section: {
  type: WebsiteSection['type'];
  content: JsonRecord;
}): string {
  const variant = section.content['variant'];

  return typeof variant === 'string' && variant.trim() ? variant : section.type;
}
