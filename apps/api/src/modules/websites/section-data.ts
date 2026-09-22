import { Logger } from '@nestjs/common';
import {
  parseWebsiteSectionContent,
  readWebsiteSectionSource,
  type WebsiteSection,
  type WebsiteSectionChurchFlowSource,
} from '@churchflow/shared';

const sectionDataLogger = new Logger('SectionData');

/** How long a resolver may take before the section falls back to its stored content. */
const SECTION_DATA_TIMEOUT_MS = 2000;

export type WebsiteSectionModule = WebsiteSectionChurchFlowSource['module'];

/** What a resolver is allowed to read. A module that needs persistence gets it added here. */
export interface SectionDataContext {
  organizationId: string;
}

export interface SectionDataRequest {
  type: WebsiteSection['type'];
  /** The stored content: the section's manual copy and the fallback for everything below. */
  content: Record<string, unknown>;
  /** References and display settings the owner chose, never copies of internal records. */
  source: WebsiteSectionChurchFlowSource;
}

export interface SectionDataResolver {
  /** False while the module has no live implementation, which keeps the section on manual content. */
  readonly implemented: boolean;
  resolve(
    request: SectionDataRequest,
    context: SectionDataContext,
  ): Promise<Record<string, unknown>>;
}

export type SectionDataRegistry = Record<WebsiteSectionModule, SectionDataResolver>;

/** Manual content is the fallback everywhere: the section renders exactly what its owner stored. */
export function manualSectionContent(content: Record<string, unknown>): Record<string, unknown> {
  return content;
}

const unimplementedSectionDataResolver: SectionDataResolver = {
  implemented: false,
  resolve: (request) => Promise.resolve(manualSectionContent(request.content)),
};

/**
 * The resolvers that turn a section's ChurchFlow source into the content its renderer reads.
 *
 * To connect a module: write its resolver and replace its entry below. Nothing else changes — the
 * renderers, `toPublicSection` and the shape of the public payload all stay as they are.
 *
 * A resolver must:
 * - return content the section type's own schema accepts, because resolved content is validated
 *   with `parseWebsiteSectionContent` exactly as a save is: unknown keys inside `items` and the
 *   other nested objects are dropped, lengths and formats are enforced, unsafe links are refused,
 *   and content that fails degrades to the stored content. Unknown top-level keys survive that
 *   parse and are then stripped by `publicWebsiteSectionKeys`;
 * - project public-safe values itself and never return internal records or ids; honouring whatever
 *   "approved for public display" flag its module owns is the resolver's own responsibility, and so
 *   is picking the fields to publish rather than spreading a database row into the content;
 * - read nothing outside the organization it is handed in the context;
 * - resolve rather than reject, because a throw or a timeout degrades the section to its stored
 *   manual content, which is always the fallback;
 * - batch its own reads: every section of a page resolves at once, and a timed-out resolver is
 *   abandoned rather than aborted, so its query still runs to completion. There is no cancellation
 *   signal yet; an AbortSignal on the context is where one belongs.
 *
 * What the first real integration will also have to do, none of which this seam decides:
 * - extend `SectionDataContext` and populate it at the single call site in `PagesService`. It
 *   carries the organization id only; a module that needs the locale or the time zone reads them
 *   from `website.settings`, which that call site already has. A resolver cannot take Nest-injected
 *   services, because the registry is a module-level constant: services travel through the context,
 *   which means `PagesService` injects them and `PagesModule` imports the owning module — watch for
 *   a circular module import there.
 * - preserve the source through the editor save path. `sectionInput` in the web form utils rebuilds
 *   content from the form fields, so a save from today's editor would drop a stored source.
 */
export const sectionDataResolvers: SectionDataRegistry = {
  events: unimplementedSectionDataResolver,
  groups: unimplementedSectionDataResolver,
  leaders: unimplementedSectionDataResolver,
  media: unimplementedSectionDataResolver,
  announcements: unimplementedSectionDataResolver,
  giving: unimplementedSectionDataResolver,
  serviceSchedule: unimplementedSectionDataResolver,
};

export interface SectionDataOptions {
  resolvers?: SectionDataRegistry;
  timeoutMs?: number;
}

interface StoredSection {
  type: WebsiteSection['type'];
  content: unknown;
}

function isContentRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function withTimeout<T>(task: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      task,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`Timed out after ${String(timeoutMs)}ms`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function resolveSectionContent(
  section: StoredSection,
  context: SectionDataContext,
  options: SectionDataOptions,
): Promise<Record<string, unknown>> {
  const stored = isContentRecord(section.content) ? section.content : {};
  const source = readWebsiteSectionSource(stored);
  if (source.mode === 'manual') return manualSectionContent(stored);

  try {
    const resolver = (options.resolvers ?? sectionDataResolvers)[source.module];
    if (!resolver.implemented) return manualSectionContent(stored);

    const resolved = await withTimeout(
      resolver.resolve({ type: section.type, content: stored, source }, context),
      options.timeoutMs ?? SECTION_DATA_TIMEOUT_MS,
    );
    if (!isContentRecord(resolved)) return manualSectionContent(stored);

    // Resolved content faces the same rules as saved content, so a resolver cannot publish a
    // nested internal field or an unsafe link that the editor could never have stored.
    const parsed = parseWebsiteSectionContent(section.type, resolved);
    if (parsed.success) return parsed.content;

    sectionDataLogger.warn(
      `The ${source.module} resolver returned content a ${section.type} section cannot publish, rendering stored content: ${parsed.issues
        .map((issue) => issue.path.join('.'))
        .join(', ')}`,
    );

    return manualSectionContent(stored);
  } catch (error) {
    // A module that is down must not take a published page with it.
    sectionDataLogger.warn(
      `The ${source.module} resolver failed for a ${section.type} section, rendering stored content: ${
        error instanceof Error ? error.message : 'unknown error'
      }`,
    );

    return manualSectionContent(stored);
  }
}

export async function resolveSectionsContent<TSection extends StoredSection>(
  sections: readonly TSection[],
  context: SectionDataContext,
  options: SectionDataOptions = {},
): Promise<Array<TSection & { content: Record<string, unknown> }>> {
  // Sections resolve together, so one slow module only delays itself.
  return Promise.all(
    sections.map(async (section) => ({
      ...section,
      content: await resolveSectionContent(section, context, options),
    })),
  );
}
