'use server';

import {
  createWebsitePageAction,
  createWebsiteSectionAction,
  deleteWebsiteSectionAction,
  publishWebsiteAction,
  publishWebsitePageAction,
  reorderWebsiteSectionsAction,
  updateWebsitePageAction,
  updateWebsiteSectionAction,
  updateWebsiteSettingsAction,
} from './actions';
import type { DashboardPage, DashboardSection, DashboardWebsite } from './types';
import { pageInput, sectionInput, websiteSettingsInput } from './website-form-utils';
import { sectionVariant, STARTER_HOME_SECTIONS } from './website-section-presets';

export type WebsiteFormResult =
  | { ok: false; error: string }
  | { ok: true; message: string; mutation: WebsiteMutation };

type WebsiteMutation =
  | { type: 'website'; website: DashboardWebsite }
  | { type: 'page'; page: DashboardPage }
  | { type: 'page-created'; page: DashboardPage }
  | { type: 'section-created'; pageId: string; section: DashboardSection }
  | { type: 'section-updated'; section: DashboardSection }
  | { type: 'section-deleted'; sectionId: string }
  | { type: 'sections-reordered'; pageId: string; sections: DashboardSection[] }
  | { type: 'starter-home'; page?: DashboardPage; pageId: string; sections: DashboardSection[] };

export async function updateSettings(formData: FormData) {
  const organizationId = readOrganizationId(formData);
  const result = await updateWebsiteSettingsAction({
    organizationId,
    settings: websiteSettingsInput(formData),
  });
  return actionResult(result, 'Website settings saved.', (success) => ({
    type: 'website',
    website: success.website,
  }));
}

export async function setWebsitePublished(formData: FormData) {
  const organizationId = readOrganizationId(formData);
  const result = await publishWebsiteAction({
    organizationId,
    published: formData.get('published') === 'true',
  });
  return actionResult(result, 'Website publication status updated.', (success) => ({
    type: 'website',
    website: success.website,
  }));
}

export async function createPage(formData: FormData) {
  const organizationId = readOrganizationId(formData);
  const result = await createWebsitePageAction({
    organizationId,
    page: pageInput(formData),
  });
  return actionResult(result, 'Page created.', (success) => ({
    type: 'page-created',
    page: success.page,
  }));
}

export async function createStarterHome(formData: FormData) {
  const organizationId = readOrganizationId(formData);
  let pageId = String(formData.get('pageId') ?? '');
  let createdPage: DashboardPage | undefined;
  const existingVariants = new Set(
    String(formData.get('existingVariants') ?? '')
      .split(',')
      .filter(Boolean),
  );

  if (!pageId) {
    const pageResult = await createWebsitePageAction({
      organizationId,
      page: {
        slug: 'home',
        title: 'Home',
        status: 'PUBLISHED',
        seo: {},
      },
    });
    if (!pageResult.ok) {
      return actionError(pageResult.error);
    }
    pageId = pageResult.page.id;
    createdPage = pageResult.page;
  }

  const createdSectionItems: DashboardSection[] = [];
  for (const section of STARTER_HOME_SECTIONS) {
    if (existingVariants.has(sectionVariant(section))) {
      continue;
    }

    const result = await createWebsiteSectionAction({
      organizationId,
      pageId,
      section,
    });
    if (!result.ok) {
      return actionError(result.error);
    }
    createdSectionItems.push(result.section);
  }

  return {
    ok: true as const,
    message:
      createdSectionItems.length > 0
        ? 'Starter home page added.'
        : 'Starter home page is already complete.',
    mutation: {
      type: 'starter-home' as const,
      ...(createdPage ? { page: createdPage } : {}),
      pageId,
      sections: createdSectionItems,
    },
  };
}

export async function updatePage(formData: FormData) {
  const organizationId = readOrganizationId(formData);
  const result = await updateWebsitePageAction({
    organizationId,
    pageId: String(formData.get('pageId')),
    page: pageInput(formData),
  });
  return actionResult(result, 'Page saved.', (success) => ({
    type: 'page',
    page: success.page,
  }));
}

export async function setPagePublished(formData: FormData) {
  const organizationId = readOrganizationId(formData);
  const result = await publishWebsitePageAction({
    organizationId,
    pageId: String(formData.get('pageId')),
    published: formData.get('published') === 'true',
  });
  return actionResult(result, 'Page publication status updated.', (success) => ({
    type: 'page',
    page: success.page,
  }));
}

export async function createSection(formData: FormData) {
  const organizationId = readOrganizationId(formData);
  const result = await createWebsiteSectionAction({
    organizationId,
    pageId: String(formData.get('pageId')),
    section: sectionInput(formData),
  });
  return actionResult(result, 'Section added.', (success) => ({
    type: 'section-created',
    pageId: String(formData.get('pageId')),
    section: success.section,
  }));
}

export async function updateSection(formData: FormData) {
  const organizationId = readOrganizationId(formData);
  const result = await updateWebsiteSectionAction({
    organizationId,
    sectionId: String(formData.get('sectionId')),
    section: sectionInput(formData),
  });
  return actionResult(result, 'Section saved.', (success) => ({
    type: 'section-updated',
    section: success.section,
  }));
}

export async function deleteSection(formData: FormData) {
  const organizationId = readOrganizationId(formData);
  const result = await deleteWebsiteSectionAction({
    organizationId,
    sectionId: String(formData.get('sectionId')),
  });
  return actionResult(result, 'Section removed.', (success) => ({
    type: 'section-deleted',
    sectionId: success.sectionId,
  }));
}

export async function reorderSections(formData: FormData) {
  const organizationId = readOrganizationId(formData);
  const sectionIds = String(formData.get('sectionIds') ?? '')
    .split(',')
    .filter(Boolean);
  const fromIndex = Number(formData.get('fromIndex'));
  const toIndex = Number(formData.get('toIndex'));
  const nextIds = [...sectionIds];
  const [moved] = nextIds.splice(fromIndex, 1);
  if (moved) nextIds.splice(toIndex, 0, moved);

  const result = await reorderWebsiteSectionsAction({
    organizationId,
    pageId: String(formData.get('pageId')),
    sectionIds: nextIds,
  });
  return actionResult(result, 'Sections reordered.', (success) => ({
    type: 'sections-reordered',
    pageId: String(formData.get('pageId')),
    sections: success.sections,
  }));
}

function readOrganizationId(formData: FormData): string {
  return String(formData.get('organizationId') ?? '');
}

function actionResult<TResult extends { ok: true } | { ok: false; error: string }>(
  result: TResult,
  successMessage: string,
  mutation: (success: Extract<TResult, { ok: true }>) => WebsiteMutation,
): WebsiteFormResult {
  if (!result.ok) {
    return actionError(result.error);
  }

  return {
    ok: true,
    message: successMessage,
    mutation: mutation(result as Extract<TResult, { ok: true }>),
  };
}

function actionError(error: string): WebsiteFormResult {
  return { ok: false, error };
}
