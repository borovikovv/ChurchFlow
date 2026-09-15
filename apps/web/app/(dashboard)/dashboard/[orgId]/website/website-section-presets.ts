import {
  PUBLIC_SECTION_TYPES,
  WEBSITE_TEMPLATE_DEFINITIONS,
  type WebsiteSection,
  type WebsiteTemplateId,
} from '@churchflow/shared';
import type { JsonRecord } from './types';

export const SECTION_FIELD_GROUPS = [
  'font',
  'titleBody',
  'eyebrow',
  'buttons',
  'items',
  'contact',
  'copyright',
  'socials',
  'background',
  'live',
  'ways',
  'links',
] as const;

export type SectionFieldGroup = (typeof SECTION_FIELD_GROUPS)[number];
export type SectionType = WebsiteSection['type'];

export interface SectionVariantDefinition {
  type: SectionType;
  variant: string;
  fields: readonly SectionFieldGroup[];
  templates: readonly WebsiteTemplateId[];
}

// Every section kind the editor can add, per template. Older sections whose variant is not
// listed fall back to the first variant of their type so they stay editable.
export const SECTION_VARIANTS: readonly SectionVariantDefinition[] = [
  {
    type: 'hero',
    variant: 'hero',
    fields: ['font', 'titleBody', 'buttons', 'background'],
    templates: ['default'],
  },
  {
    type: 'contact',
    variant: 'contact',
    fields: ['font', 'titleBody', 'contact', 'buttons', 'background'],
    templates: ['default'],
  },
  {
    type: 'contact',
    variant: 'footer',
    fields: ['font', 'titleBody', 'contact', 'copyright', 'socials', 'buttons', 'background'],
    templates: ['default'],
  },
  {
    type: 'hero',
    variant: 'cover',
    fields: ['eyebrow', 'titleBody', 'buttons', 'background'],
    templates: ['city'],
  },
  {
    type: 'live',
    variant: 'banner',
    fields: ['live', 'buttons', 'background'],
    templates: ['city'],
  },
  {
    type: 'schedule',
    variant: 'location',
    fields: ['eyebrow', 'titleBody', 'buttons', 'background'],
    templates: ['city'],
  },
  {
    type: 'giving',
    variant: 'cover',
    fields: ['eyebrow', 'titleBody', 'buttons', 'ways', 'background'],
    templates: ['city'],
  },
  {
    type: 'footer',
    variant: 'columns',
    fields: ['titleBody', 'contact', 'copyright', 'links'],
    templates: ['city'],
  },
];

export const SECTION_FONT_PRESETS = [
  { label: 'Default', value: 'default' },
  { label: 'Montserrat body', value: 'montserrat-body' },
  { label: 'Montserrat heading', value: 'montserrat-heading' },
] as const;

export function sectionVariantsForTemplate(
  template: WebsiteTemplateId,
): SectionVariantDefinition[] {
  const renderable = WEBSITE_TEMPLATE_DEFINITIONS[template].sectionTypes;

  return SECTION_VARIANTS.filter(
    (definition) => definition.templates.includes(template) && renderable.includes(definition.type),
  );
}

export function sectionDefinition(
  section: { type: SectionType; content: JsonRecord },
  template: WebsiteTemplateId,
): SectionVariantDefinition {
  const variant = sectionVariant(section);
  const byVariant = SECTION_VARIANTS.find(
    (definition) => definition.type === section.type && definition.variant === variant,
  );
  if (byVariant) return byVariant;

  return (
    sectionVariantsForTemplate(template).find((definition) => definition.type === section.type) ??
    SECTION_VARIANTS.find((definition) => definition.type === section.type) ?? {
      type: section.type,
      variant,
      fields: ['titleBody', 'buttons', 'background'],
      templates: [],
    }
  );
}

export function sectionVariant(section: { type: SectionType; content: JsonRecord }): string {
  const variant = section.content['variant'];

  return typeof variant === 'string' && variant.trim() ? variant : section.type;
}

export function isSectionType(value: string): value is SectionType {
  return (PUBLIC_SECTION_TYPES as readonly string[]).includes(value);
}

// Whether the current template will draw the section at all; other kinds stay stored.
export function isRenderableByTemplate(type: SectionType, template: WebsiteTemplateId): boolean {
  return WEBSITE_TEMPLATE_DEFINITIONS[template].sectionTypes.includes(type);
}
