import type { Prisma } from '@churchflow/db';
import type { WebsiteTemplateSectionDefinition } from '@churchflow/shared';

/** The stored content of a template section: its variant plus the template copy. */
export function templateSectionContent(
  section: WebsiteTemplateSectionDefinition,
): Prisma.InputJsonObject {
  return { variant: section.variant, ...section.content };
}
