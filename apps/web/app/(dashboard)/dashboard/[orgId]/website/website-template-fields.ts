import type { WebsiteTemplateId } from '@churchflow/shared';

// Some style controls are only read by some templates: the city components take the accent colour
// and the section background image, and ignore the theme background, the section font preset and
// the section background colour, while the classic template reads all three. An editor control the
// active template never renders is a promise the site cannot keep, so it is hidden instead. The
// stored value is kept either way, because the site may switch back.
export const TEMPLATE_STYLE_CONTROLS = [
  'themeBackground',
  'sectionFontPreset',
  'sectionBackgroundColor',
] as const;

export type TemplateStyleControl = (typeof TEMPLATE_STYLE_CONTROLS)[number];

const TEMPLATE_STYLE_CONTROLS_READ: Record<WebsiteTemplateId, readonly TemplateStyleControl[]> = {
  default: ['themeBackground', 'sectionFontPreset', 'sectionBackgroundColor'],
  city: [],
};

export function templateReadsStyleControl(
  template: WebsiteTemplateId,
  control: TemplateStyleControl,
): boolean {
  return TEMPLATE_STYLE_CONTROLS_READ[template].includes(control);
}

export function inertStyleControls(template: WebsiteTemplateId): TemplateStyleControl[] {
  return TEMPLATE_STYLE_CONTROLS.filter((control) => !templateReadsStyleControl(template, control));
}
