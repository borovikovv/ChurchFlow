'use server';

import { getCurrentUser } from '@/auth/session';
import { getMessages } from '@/i18n/messages';
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
import { sectionVariant } from './website-section-presets';

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

export async function createPage(formData: FormData) {
  const messages = await currentWebsiteMessages();
  const organizationId = readOrganizationId(formData);
  const result = await createWebsitePageAction({
    organizationId,
    page: pageInput(formData),
  });
  return actionResult(result, messages.messages.pageCreated, (success) => ({
    type: 'page-created',
    page: success.page,
  }));
}

export async function createStarterHome(formData: FormData) {
  const messages = await currentWebsiteMessages();
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
        title: messages.starterContent.homeTitle,
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
  for (const section of starterHomeSections(messages)) {
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
        ? messages.messages.starterHomeAdded
        : messages.messages.starterHomeComplete,
    mutation: {
      type: 'starter-home' as const,
      ...(createdPage ? { page: createdPage } : {}),
      pageId,
      sections: createdSectionItems,
    },
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
  const result = await createWebsiteSectionAction({
    organizationId,
    pageId: String(formData.get('pageId')),
    section: sectionInput(formData),
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

async function currentWebsiteMessages() {
  const user = await getCurrentUser();
  return getMessages(user?.locale ?? 'en').website;
}

function starterHomeSections(messages: Awaited<ReturnType<typeof currentWebsiteMessages>>) {
  return [
    {
      type: 'hero',
      order: 0,
      content: {
        variant: 'hero',
        headline: messages.starterContent.heroHeadline,
        subheading: messages.starterContent.heroSubheading,
        primaryLabel: messages.starterContent.planVisit,
        primaryHref: '#visit',
        secondaryLabel: messages.starterContent.watchOnline,
        secondaryHref: '#',
      },
    },
    {
      type: 'contact',
      order: 1,
      content: {
        variant: 'contact',
        title: messages.starterContent.contactTitle,
        body: messages.starterContent.contactBody,
        email: 'hello@example.com',
        phone: '(555) 000-0000',
        address: messages.starterContent.address,
      },
    },
    {
      type: 'contact',
      order: 2,
      content: {
        variant: 'footer',
        title: messages.starterContent.footerTitle,
        address: messages.starterContent.address,
        email: 'hello@example.com',
        phone: '(555) 000-0000',
        copyright: messages.starterContent.copyright,
        primaryLabel: messages.starterContent.give,
        primaryHref: '#give',
      },
    },
  ] as const;
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
