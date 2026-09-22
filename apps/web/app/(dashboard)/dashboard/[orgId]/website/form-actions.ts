'use server';

import {
  websiteTemplateVariantContent,
  WEBSITE_TEMPLATES,
  type WebsiteTemplateId,
} from '@churchflow/shared';
import { getCurrentUser } from '@/auth/session';
import { getMessages } from '@/i18n/messages';
import {
  applyWebsiteTemplateAction,
  createWebsitePageAction,
  createWebsiteSectionAction,
  deleteWebsiteSectionAction,
  duplicateWebsiteSectionAction,
  publishWebsiteAction,
  publishWebsitePageAction,
  reorderWebsiteSectionsAction,
  setWebsiteSectionHiddenAction,
  updateWebsitePageAction,
  updateWebsiteSectionAction,
  updateWebsiteSettingsAction,
} from './actions';
import type { DashboardPage, DashboardSection, DashboardWebsite } from './types';
import {
  navigationAppendInput,
  pageInput,
  sectionInput,
  websiteSettingsInput,
} from './website-form-utils';

export type WebsiteFormResult =
  | { ok: false; error: string }
  | { ok: true; message: string; mutation: WebsiteMutation };

export type WebsiteMutation =
  | { type: 'website'; website: DashboardWebsite }
  | { type: 'page'; page: DashboardPage }
  | { type: 'page-created'; page: DashboardPage; website?: DashboardWebsite }
  | { type: 'section-created'; pageId: string; section: DashboardSection }
  | { type: 'section-updated'; section: DashboardSection }
  | { type: 'section-deleted'; sectionId: string }
  | { type: 'sections-reordered'; pageId: string; sections: DashboardSection[] }
  | { type: 'template-applied'; website: DashboardWebsite; page: DashboardPage | null };

export async function updateSettings(formData: FormData) {
  const messages = await currentWebsiteMessages();
  const organizationId = readOrganizationId(formData);
  const result = await updateWebsiteSettingsAction({
    organizationId,
    settings: websiteSettingsInput(formData),
  });
  return actionResult(result, messages.messages.settingsSaved, (success) => ({
    type: 'website',
    website: success.website,
  }));
}

export async function setWebsitePublished(formData: FormData) {
  const messages = await currentWebsiteMessages();
  const organizationId = readOrganizationId(formData);
  const result = await publishWebsiteAction({
    organizationId,
    published: formData.get('published') === 'true',
  });
  return actionResult(result, messages.messages.publicationUpdated, (success) => ({
    type: 'website',
    website: success.website,
  }));
}

export async function applyTemplate(formData: FormData) {
  const messages = await currentWebsiteMessages();
  const organizationId = readOrganizationId(formData);
  const result = await applyWebsiteTemplateAction({
    organizationId,
    template: {
      templateId: templateId(String(formData.get('templateId') ?? '')),
      addMissingSections: formData.get('addMissingSections') === 'true',
      resetTheme: formData.get('resetTheme') === 'true',
    },
  });
  return actionResult(result, messages.messages.templateApplied, (success) => ({
    type: 'template-applied',
    website: success.website,
    page: success.page,
  }));
}

// The new page is created first; only then can its link be appended to the stored menu, so the
// menu is patched with a second request and never blocks the page from being created.
export async function createPage(formData: FormData) {
  const messages = await currentWebsiteMessages();
  const organizationId = readOrganizationId(formData);
  const result = await createWebsitePageAction({
    organizationId,
    page: pageInput(formData),
  });
  if (!result.ok) return actionError(result.error);

  const menu = navigationAppendInput(formData, result.page);
  if (menu.status === 'ready') {
    const updated = await updateWebsiteSettingsAction({ organizationId, settings: menu.settings });

    return {
      ok: true as const,
      message: updated.ok ? messages.messages.pageCreated : messages.messages.pageCreatedMenuFailed,
      mutation: {
        type: 'page-created' as const,
        page: result.page,
        ...(updated.ok ? { website: updated.website } : {}),
      },
    };
  }

  return {
    ok: true as const,
    message:
      menu.status === 'menu-full'
        ? messages.messages.pageCreatedMenuFull
        : messages.messages.pageCreated,
    mutation: { type: 'page-created' as const, page: result.page },
  };
}

export async function updatePage(formData: FormData) {
  const messages = await currentWebsiteMessages();
  const organizationId = readOrganizationId(formData);
  const result = await updateWebsitePageAction({
    organizationId,
    pageId: String(formData.get('pageId')),
    page: pageInput(formData),
  });
  return actionResult(result, messages.messages.pageSaved, (success) => ({
    type: 'page',
    page: success.page,
  }));
}

export async function setPagePublished(formData: FormData) {
  const messages = await currentWebsiteMessages();
  const organizationId = readOrganizationId(formData);
  const result = await publishWebsitePageAction({
    organizationId,
    pageId: String(formData.get('pageId')),
    published: formData.get('published') === 'true',
  });
  return actionResult(result, messages.messages.pagePublicationUpdated, (success) => ({
    type: 'page',
    page: success.page,
  }));
}

export async function createSection(formData: FormData) {
  const messages = await currentWebsiteMessages();
  const organizationId = readOrganizationId(formData);
  const section = sectionInput(formData);
  const content = section.content ?? {};
  const defaults = websiteTemplateVariantContent(
    templateId(String(formData.get('templateId') ?? '')),
    section.type,
    String(content['variant'] ?? ''),
  );
  const result = await createWebsiteSectionAction({
    organizationId,
    pageId: String(formData.get('pageId')),
    section: { ...section, content: { ...defaults, ...content } },
  });
  return actionResult(result, messages.messages.sectionAdded, (success) => ({
    type: 'section-created',
    pageId: String(formData.get('pageId')),
    section: success.section,
  }));
}

export async function updateSection(formData: FormData) {
  const messages = await currentWebsiteMessages();
  const organizationId = readOrganizationId(formData);
  const result = await updateWebsiteSectionAction({
    organizationId,
    sectionId: String(formData.get('sectionId')),
    section: sectionInput(formData),
  });
  return actionResult(result, messages.messages.sectionSaved, (success) => ({
    type: 'section-updated',
    section: success.section,
  }));
}

export async function setSectionHidden(formData: FormData) {
  const messages = await currentWebsiteMessages();
  const organizationId = readOrganizationId(formData);
  const hidden = formData.get('hidden') === 'true';
  const result = await setWebsiteSectionHiddenAction({
    organizationId,
    sectionId: String(formData.get('sectionId')),
    hidden,
  });
  return actionResult(
    result,
    hidden ? messages.messages.sectionHidden : messages.messages.sectionShown,
    (success) => ({ type: 'section-updated', section: success.section }),
  );
}

export async function duplicateSection(formData: FormData) {
  const messages = await currentWebsiteMessages();
  const organizationId = readOrganizationId(formData);
  const result = await duplicateWebsiteSectionAction({
    organizationId,
    sectionId: String(formData.get('sectionId')),
  });
  return actionResult(result, messages.messages.sectionDuplicated, (success) => ({
    type: 'section-created',
    pageId: String(formData.get('pageId')),
    section: success.section,
  }));
}

export async function deleteSection(formData: FormData) {
  const messages = await currentWebsiteMessages();
  const organizationId = readOrganizationId(formData);
  const result = await deleteWebsiteSectionAction({
    organizationId,
    sectionId: String(formData.get('sectionId')),
  });
  return actionResult(result, messages.messages.sectionRemoved, (success) => ({
    type: 'section-deleted',
    sectionId: success.sectionId,
  }));
}

export async function reorderSections(formData: FormData) {
  const messages = await currentWebsiteMessages();
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
  return actionResult(result, messages.messages.sectionsReordered, (success) => ({
    type: 'sections-reordered',
    pageId: String(formData.get('pageId')),
    sections: success.sections,
  }));
}

function readOrganizationId(formData: FormData): string {
  return String(formData.get('organizationId') ?? '');
}

function templateId(value: string): WebsiteTemplateId {
  return WEBSITE_TEMPLATES.find((template) => template === value) ?? 'default';
}

async function currentWebsiteMessages() {
  const user = await getCurrentUser();
  return getMessages(user?.locale ?? 'en').website;
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
