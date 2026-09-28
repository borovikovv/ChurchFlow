'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch } from '@/api/client';
import type { DashboardPage, DashboardSection, DashboardWebsite } from './types';
import type {
  ApplyWebsiteTemplateInput,
  PublishWebsiteInput,
  PublishWebsitePageInput,
  ReorderWebsiteSectionsInput,
  UpdateWebsiteSettingsPayload,
  UpsertWebsitePagePayload,
  UpsertWebsiteSectionPayload,
} from '@churchflow/shared';

const jsonHeaders = { 'content-type': 'application/json' };

// Read back the stored website before an action that patches part of it, so a stale editor cannot
// send its own copy of the title, description or menu.
export async function readWebsiteAction(input: { organizationId: string }) {
  const result = await apiFetch<DashboardWebsite>(`/organizations/${input.organizationId}/website`);

  return result.ok
    ? { ok: true as const, website: result.data }
    : { ok: false as const, error: result.error.message };
}

export async function updateWebsiteSettingsAction(input: {
  organizationId: string;
  settings: UpdateWebsiteSettingsPayload;
}) {
  const result = await apiFetch<DashboardWebsite>(
    `/organizations/${input.organizationId}/website`,
    {
      method: 'PATCH',
      headers: jsonHeaders,
      body: JSON.stringify(input.settings),
    },
  );
  revalidateWebsite(input.organizationId);

  return result.ok
    ? { ok: true as const, website: result.data }
    : { ok: false as const, error: result.error.message };
}

export async function publishWebsiteAction(input: {
  organizationId: string;
  published: PublishWebsiteInput['published'];
}) {
  const result = await apiFetch<DashboardWebsite>(
    `/organizations/${input.organizationId}/website/publish`,
    {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ published: input.published }),
    },
  );
  revalidateWebsite(input.organizationId);

  return result.ok
    ? { ok: true as const, website: result.data }
    : { ok: false as const, error: result.error.message };
}

export async function applyWebsiteTemplateAction(input: {
  organizationId: string;
  template: ApplyWebsiteTemplateInput;
}) {
  const result = await apiFetch<{
    website: DashboardWebsite;
    page: DashboardPage | null;
    addedSections: number;
  }>(`/organizations/${input.organizationId}/website/template`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify(input.template),
  });
  revalidateWebsite(input.organizationId);

  return result.ok
    ? { ok: true as const, ...result.data }
    : { ok: false as const, error: result.error.message };
}

export async function createWebsitePageAction(input: {
  organizationId: string;
  page: UpsertWebsitePagePayload;
}) {
  const result = await apiFetch<DashboardPage>(`/organizations/${input.organizationId}/pages`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify(input.page),
  });
  revalidateWebsite(input.organizationId);

  return result.ok
    ? { ok: true as const, page: result.data }
    : { ok: false as const, error: result.error.message };
}

export async function updateWebsitePageAction(input: {
  organizationId: string;
  pageId: string;
  page: UpsertWebsitePagePayload;
}) {
  const result = await apiFetch<DashboardPage>(
    `/organizations/${input.organizationId}/pages/${input.pageId}`,
    {
      method: 'PATCH',
      headers: jsonHeaders,
      body: JSON.stringify(input.page),
    },
  );
  revalidateWebsite(input.organizationId);

  return result.ok
    ? { ok: true as const, page: result.data }
    : { ok: false as const, error: result.error.message };
}

export async function publishWebsitePageAction(input: {
  organizationId: string;
  pageId: string;
  published: PublishWebsitePageInput['published'];
}) {
  const result = await apiFetch<DashboardPage>(
    `/organizations/${input.organizationId}/pages/${input.pageId}/publish`,
    {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ published: input.published }),
    },
  );
  revalidateWebsite(input.organizationId);

  return result.ok
    ? { ok: true as const, page: result.data }
    : { ok: false as const, error: result.error.message };
}

export async function createWebsiteSectionAction(input: {
  organizationId: string;
  pageId: string;
  section: UpsertWebsiteSectionPayload;
}) {
  const result = await apiFetch<DashboardSection>(
    `/organizations/${input.organizationId}/pages/${input.pageId}/sections`,
    {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(input.section),
    },
  );
  revalidateWebsite(input.organizationId);

  return result.ok
    ? { ok: true as const, section: result.data }
    : { ok: false as const, error: result.error.message };
}

export async function updateWebsiteSectionAction(input: {
  organizationId: string;
  sectionId: string;
  section: UpsertWebsiteSectionPayload;
}) {
  const result = await apiFetch<DashboardSection>(
    `/organizations/${input.organizationId}/sections/${input.sectionId}`,
    {
      method: 'PATCH',
      headers: jsonHeaders,
      body: JSON.stringify(input.section),
    },
  );
  revalidateWebsite(input.organizationId);

  return result.ok
    ? { ok: true as const, section: result.data }
    : { ok: false as const, error: result.error.message };
}

export async function setWebsiteSectionHiddenAction(input: {
  organizationId: string;
  sectionId: string;
  hidden: boolean;
}) {
  const result = await apiFetch<DashboardSection>(
    `/organizations/${input.organizationId}/sections/${input.sectionId}/hidden`,
    {
      method: 'PATCH',
      headers: jsonHeaders,
      body: JSON.stringify({ hidden: input.hidden }),
    },
  );
  revalidateWebsite(input.organizationId);

  return result.ok
    ? { ok: true as const, section: result.data }
    : { ok: false as const, error: result.error.message };
}

export async function duplicateWebsiteSectionAction(input: {
  organizationId: string;
  sectionId: string;
}) {
  const result = await apiFetch<DashboardSection>(
    `/organizations/${input.organizationId}/sections/${input.sectionId}/duplicate`,
    { method: 'POST' },
  );
  revalidateWebsite(input.organizationId);

  return result.ok
    ? { ok: true as const, section: result.data }
    : { ok: false as const, error: result.error.message };
}

export async function deleteWebsiteSectionAction(input: {
  organizationId: string;
  sectionId: string;
}) {
  const result = await apiFetch<{ id: string }>(
    `/organizations/${input.organizationId}/sections/${input.sectionId}`,
    { method: 'DELETE' },
  );
  revalidateWebsite(input.organizationId);

  return result.ok
    ? { ok: true as const, sectionId: result.data.id }
    : { ok: false as const, error: result.error.message };
}

export async function reorderWebsiteSectionsAction(input: {
  organizationId: string;
  pageId: string;
  sectionIds: ReorderWebsiteSectionsInput['sectionIds'];
}) {
  const result = await apiFetch<DashboardSection[]>(
    `/organizations/${input.organizationId}/pages/${input.pageId}/sections/reorder`,
    {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ sectionIds: input.sectionIds }),
    },
  );
  revalidateWebsite(input.organizationId);

  return result.ok
    ? { ok: true as const, sections: result.data }
    : { ok: false as const, error: result.error.message };
}

export async function prepareWebsiteSectionBackgroundImageAction(input: {
  organizationId: string;
  filename: string;
  mimeType: string;
  byteSize: number;
}) {
  const result = await apiFetch<{ assetId: string; uploadUrl: string }>(
    `/organizations/${input.organizationId}/media/website-sections/background-upload`,
    {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(input),
    },
  );

  return result.ok
    ? { ok: true as const, ...result.data }
    : { ok: false as const, error: result.error.message };
}

export async function confirmWebsiteSectionBackgroundImageAction(input: {
  organizationId: string;
  assetId: string;
}) {
  const result = await apiFetch<{ assetId: string }>(
    `/organizations/${input.organizationId}/media/website-sections/background-confirm`,
    {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ assetId: input.assetId }),
    },
  );
  if (!result.ok) return { ok: false as const, error: result.error.message };

  const readUrl = await apiFetch<{ url: string }>(
    `/organizations/${input.organizationId}/media/${input.assetId}/read-url`,
  );

  return readUrl.ok
    ? { ok: true as const, assetId: input.assetId, imageUrl: readUrl.data.url }
    : { ok: false as const, error: readUrl.error.message };
}

function revalidateWebsite(organizationId: string) {
  revalidatePath(`/dashboard/${organizationId}/website`);
  revalidatePath('/o/[orgSlug]', 'page');
  revalidatePath('/o/[orgSlug]/[pageSlug]', 'page');
}
