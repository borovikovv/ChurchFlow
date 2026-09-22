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
    type: 'hero',
    variant: 'split',
    fields: ['eyebrow', 'titleBody', 'buttons', 'background'],
    templates: ['city'],
  },
  {
    type: 'about',
    variant: 'text',
    fields: ['eyebrow', 'titleBody', 'buttons', 'background'],
    templates: ['city'],
  },
  {
    type: 'about',
    variant: 'columns',
    fields: ['eyebrow', 'titleBody', 'items', 'buttons', 'background'],
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
    type: 'giving',
    variant: 'ways',
    fields: ['eyebrow', 'titleBody', 'buttons', 'ways'],
    templates: ['city'],
  },
  {
    type: 'contact',
    variant: 'details',
    fields: ['eyebrow', 'titleBody', 'contact', 'buttons'],
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

/** Enough to edit a section whose variant no template describes. */
const BASIC_FIELD_GROUPS: readonly SectionFieldGroup[] = ['titleBody', 'buttons', 'background'];

/**
 * The field groups the inspector offers for a section. Only the active template's own definitions are
 * consulted, because it is that template's components that read the values: a stored variant it does
 * not define still needs editable fields, so its first variant for the section type answers for it,
 * and a section type it cannot render at all falls back to the basics. The groups are all that is
 * borrowed — the variant itself is never taken from another definition, because the form posts it
 * back and a save must not rewrite what the owner did not change.
 */
export function sectionFieldGroups(
  section: { type: SectionType; content: JsonRecord },
  template: WebsiteTemplateId,
): readonly SectionFieldGroup[] {
  const variant = sectionVariant(section);
  const byType = sectionVariantsForTemplate(template).filter(
    (definition) => definition.type === section.type,
  );
  const definition = byType.find((candidate) => candidate.variant === variant) ?? byType[0];

  return definition?.fields ?? BASIC_FIELD_GROUPS;
}

export interface SectionVariantChoice {
  variant: string;
  /** False for a stored variant the active template cannot render, which is shown but not offered. */
  renderable: boolean;
}

/**
 * The variants the inspector may offer for a section: the ones the active template renders, plus
 * the section's own stored variant when that template does not render it, so selecting nothing
 * keeps the section exactly as it is.
 */
export function sectionVariantChoices(
  section: { type: SectionType; content: JsonRecord },
  template: WebsiteTemplateId,
): SectionVariantChoice[] {
  const variant = sectionVariant(section);
  const renderable = sectionVariantsForTemplate(template)
    .filter((definition) => definition.type === section.type)
    .map((definition) => ({ variant: definition.variant, renderable: true }));

  return renderable.some((choice) => choice.variant === variant)
    ? renderable
    : [...renderable, { variant, renderable: false }];
}

export function sectionVariant(section: { type: SectionType; content: JsonRecord }): string {
  const variant = section.content['variant'];

  return typeof variant === 'string' && variant.trim() ? variant : section.type;
}

export function isSectionType(value: string): value is SectionType {
  return (PUBLIC_SECTION_TYPES as readonly string[]).includes(value);
}

export function isRenderableByTemplate(type: SectionType, template: WebsiteTemplateId): boolean {
  return WEBSITE_TEMPLATE_DEFINITIONS[template].sectionTypes.includes(type);
}
