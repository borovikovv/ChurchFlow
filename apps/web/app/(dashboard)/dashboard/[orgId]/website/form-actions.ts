'use server';

import type { Route } from 'next';
import { redirect } from 'next/navigation';
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
import { pageInput, sectionInput, websiteSettingsInput } from './website-form-utils';

export async function updateSettings(formData: FormData) {
  const organizationId = readOrganizationId(formData);
  const result = await updateWebsiteSettingsAction({
    organizationId,
    settings: websiteSettingsInput(formData),
  });
  redirectActionResult(organizationId, result, 'Website settings saved.');
}

export async function setWebsitePublished(formData: FormData) {
  const organizationId = readOrganizationId(formData);
  const result = await publishWebsiteAction({
    organizationId,
    published: formData.get('published') === 'true',
  });
  redirectActionResult(organizationId, result, 'Website publication status updated.');
}

export async function createPage(formData: FormData) {
  const organizationId = readOrganizationId(formData);
  const result = await createWebsitePageAction({
    organizationId,
    page: pageInput(formData),
  });
  redirectActionResult(organizationId, result, 'Page created.');
}

export async function updatePage(formData: FormData) {
  const organizationId = readOrganizationId(formData);
  const result = await updateWebsitePageAction({
    organizationId,
    pageId: String(formData.get('pageId')),
    page: pageInput(formData),
  });
  redirectActionResult(organizationId, result, 'Page saved.');
}

export async function setPagePublished(formData: FormData) {
  const organizationId = readOrganizationId(formData);
  const result = await publishWebsitePageAction({
    organizationId,
    pageId: String(formData.get('pageId')),
    published: formData.get('published') === 'true',
  });
  redirectActionResult(organizationId, result, 'Page publication status updated.');
}

export async function createSection(formData: FormData) {
  const organizationId = readOrganizationId(formData);
  const result = await createWebsiteSectionAction({
    organizationId,
    pageId: String(formData.get('pageId')),
    section: sectionInput(formData),
  });
  redirectActionResult(organizationId, result, 'Section added.');
}

export async function updateSection(formData: FormData) {
  const organizationId = readOrganizationId(formData);
  const result = await updateWebsiteSectionAction({
    organizationId,
    sectionId: String(formData.get('sectionId')),
    section: sectionInput(formData),
  });
  redirectActionResult(organizationId, result, 'Section saved.');
}

export async function deleteSection(formData: FormData) {
  const organizationId = readOrganizationId(formData);
  const result = await deleteWebsiteSectionAction({
    organizationId,
    sectionId: String(formData.get('sectionId')),
  });
  redirectActionResult(organizationId, result, 'Section removed.');
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
  redirectActionResult(organizationId, result, 'Sections reordered.');
}

function readOrganizationId(formData: FormData): string {
  return String(formData.get('organizationId') ?? '');
}

function redirectWithFeedback(organizationId: string, message?: string, error?: string): never {
  const params = new URLSearchParams();
  if (message) params.set('message', message);
  if (error) params.set('error', error);
  const query = params.toString();

  redirect(`/dashboard/${organizationId}/website${query ? `?${query}` : ''}` as Route);
}

function redirectActionResult(
  organizationId: string,
  result: { ok: true } | { ok: false; error: string },
  successMessage: string,
): never {
  redirectWithFeedback(
    organizationId,
    result.ok ? successMessage : undefined,
    result.ok ? undefined : result.error,
  );
}
