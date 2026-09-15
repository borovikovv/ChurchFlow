import type { WebsiteMutation } from '../form-actions';
import type { DashboardPage, DashboardSection, DashboardWebsite } from '../types';

export interface WebsiteEditorState {
  website: DashboardWebsite;
  pages: DashboardPage[];
}

// Every server action reports what changed; the editor folds it into local state instead of
// refetching, so the section list and the preview update as soon as the request returns.
export function applyWebsiteMutation(
  state: WebsiteEditorState,
  mutation: WebsiteMutation,
): WebsiteEditorState {
  switch (mutation.type) {
    case 'website':
      return { ...state, website: mutation.website };
    case 'page':
    case 'page-created':
      return { ...state, pages: upsertPage(state.pages, mutation.page) };
    case 'section-created':
      return {
        ...state,
        pages: updatePageSections(state.pages, mutation.pageId, (sections) =>
          insertSection(sections, mutation.section),
        ),
      };
    case 'section-updated':
      return {
        ...state,
        pages: state.pages.map((page) => ({
          ...page,
          sections: page.sections.map((section) =>
            section.id === mutation.section.id ? mutation.section : section,
          ),
        })),
      };
    case 'section-deleted':
      return {
        ...state,
        pages: state.pages.map((page) => ({
          ...page,
          sections: page.sections.filter((section) => section.id !== mutation.sectionId),
        })),
      };
    case 'sections-reordered':
      return {
        ...state,
        pages: updatePageSections(state.pages, mutation.pageId, () =>
          sortSections(mutation.sections),
        ),
      };
    case 'template-applied':
      return {
        website: mutation.website,
        pages: mutation.page ? upsertPage(state.pages, mutation.page) : state.pages,
      };
  }
}

// A duplicate lands at `order + 1` and the API shifted the rest; mirror that locally.
function insertSection(sections: DashboardSection[], next: DashboardSection): DashboardSection[] {
  const shifted = sections.map((section) =>
    section.order >= next.order ? { ...section, order: section.order + 1 } : section,
  );

  return sortSections([...shifted, next]);
}

function upsertPage(pages: DashboardPage[], nextPage: DashboardPage): DashboardPage[] {
  if (pages.some((page) => page.id === nextPage.id)) {
    return pages.map((page) => (page.id === nextPage.id ? nextPage : page));
  }

  return [nextPage, ...pages];
}

function updatePageSections(
  pages: DashboardPage[],
  pageId: string,
  updateSections: (sections: DashboardSection[]) => DashboardSection[],
): DashboardPage[] {
  return pages.map((page) =>
    page.id === pageId ? { ...page, sections: updateSections(page.sections) } : page,
  );
}

export function sortSections(sections: DashboardSection[]): DashboardSection[] {
  return [...sections].sort((left, right) => left.order - right.order);
}

export function sectionEditorKey(section: DashboardSection): string {
  return [
    section.id,
    section.type,
    section.order,
    section.hidden,
    JSON.stringify(section.content),
  ].join(':');
}
