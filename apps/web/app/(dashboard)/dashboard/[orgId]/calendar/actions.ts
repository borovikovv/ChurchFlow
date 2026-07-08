'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch } from '@/api/client';
import type {
  CalendarEventItem,
  CalendarEventsPayload,
  CalendarEventType,
  CalendarPreferences,
  CreateCalendarEventInput,
  UpdateCalendarEventInput,
} from '@churchflow/shared';
import { listCalendarEventsQuerySchema } from '@churchflow/shared';

export async function loadCalendarEventsAction(input: {
  organizationId: string;
  rangeStart: string;
  rangeEnd: string;
  types: CalendarEventType[];
}) {
  const parsedQuery = listCalendarEventsQuerySchema.safeParse({
    rangeStart: input.rangeStart,
    rangeEnd: input.rangeEnd,
    types: input.types,
  });
  if (!parsedQuery.success) {
    return { ok: false as const, error: 'Invalid calendar range or filters.' };
  }

  const query = new URLSearchParams({
    rangeStart: parsedQuery.data.rangeStart,
    rangeEnd: parsedQuery.data.rangeEnd,
    types: parsedQuery.data.types?.join(',') ?? '',
  });
  const result = await apiFetch<CalendarEventsPayload>(
    `/organizations/${input.organizationId}/calendar-events?${query}`,
  );
  if (!result.ok) return { ok: false as const, error: result.error.message };

  await enrichCalendarImageUrls(input.organizationId, result.data);
  return { ok: true as const, payload: result.data };
}

export async function updateCalendarPreferencesAction(input: {
  organizationId: string;
  visibleEventTypes: CalendarEventType[];
}) {
  const result = await apiFetch<CalendarPreferences>(
    `/organizations/${input.organizationId}/calendar-events/preferences`,
    {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ visibleEventTypes: input.visibleEventTypes }),
    },
  );
  return result.ok
    ? { ok: true as const, preferences: result.data }
    : { ok: false as const, error: result.error.message };
}

export async function createCalendarEventAction(input: {
  organizationId: string;
  event: CreateCalendarEventInput;
}) {
  const result = await apiFetch<CalendarEventItem>(
    `/organizations/${input.organizationId}/calendar-events`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input.event),
    },
  );
  revalidatePath(`/dashboard/${input.organizationId}/calendar`);
  return result.ok
    ? { ok: true as const, event: result.data }
    : { ok: false as const, error: result.error.message };
}

export async function updateCalendarEventAction(input: {
  organizationId: string;
  eventId: string;
  event: UpdateCalendarEventInput;
}) {
  const result = await apiFetch<CalendarEventItem>(
    `/organizations/${input.organizationId}/calendar-events/${input.eventId}`,
    {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input.event),
    },
  );
  revalidatePath(`/dashboard/${input.organizationId}/calendar`);
  return result.ok
    ? { ok: true as const, event: result.data }
    : { ok: false as const, error: result.error.message };
}

export async function deleteCalendarEventAction(input: {
  organizationId: string;
  eventId: string;
}) {
  const result = await apiFetch<{ id: string }>(
    `/organizations/${input.organizationId}/calendar-events/${input.eventId}`,
    { method: 'DELETE' },
  );
  revalidatePath(`/dashboard/${input.organizationId}/calendar`);
  return result.ok
    ? { ok: true as const, deletedEventId: result.data.id }
    : { ok: false as const, error: result.error.message };
}

export async function toggleCalendarTaskCompletionAction(input: {
  organizationId: string;
  eventId: string;
  completed: boolean;
}) {
  const result = await apiFetch<CalendarEventItem>(
    `/organizations/${input.organizationId}/calendar-events/${input.eventId}/completion`,
    {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ completed: input.completed }),
    },
  );
  return result.ok
    ? { ok: true as const, event: result.data }
    : { ok: false as const, error: result.error.message };
}

export async function prepareCalendarEventImageAction(input: {
  organizationId: string;
  filename: string;
  mimeType: string;
  byteSize: number;
}) {
  const result = await apiFetch<{ assetId: string; uploadUrl: string }>(
    `/organizations/${input.organizationId}/media/calendar-events/image-upload`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    },
  );
  return result.ok
    ? { ok: true as const, ...result.data }
    : { ok: false as const, error: result.error.message };
}

export async function confirmCalendarEventImageAction(input: {
  organizationId: string;
  assetId: string;
}) {
  const result = await apiFetch<{ assetId: string }>(
    `/organizations/${input.organizationId}/media/calendar-events/image-confirm`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
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

export async function enrichCalendarImageUrls(
  organizationId: string,
  payload: CalendarEventsPayload,
) {
  const photoAssetIds = new Set<string>();
  const eventImageIds = new Set<string>();

  payload.members.forEach((member) => {
    if (member.photoAssetId) photoAssetIds.add(member.photoAssetId);
  });
  payload.events.forEach((event) => {
    if (event.linkedMember?.photoAssetId) photoAssetIds.add(event.linkedMember.photoAssetId);
    event.assignees.forEach((assignee) => {
      if (assignee.photoAssetId) photoAssetIds.add(assignee.photoAssetId);
    });
    if (event.image?.id) eventImageIds.add(event.image.id);
  });

  const urls = new Map<string, string>();
  await Promise.all(
    [...photoAssetIds, ...eventImageIds].map(async (assetId) => {
      const result = await apiFetch<{ url: string }>(
        `/organizations/${organizationId}/media/${assetId}/read-url`,
      );
      if (result.ok) urls.set(assetId, result.data.url);
    }),
  );

  payload.members.forEach((member) => {
    if (member.photoAssetId && urls.has(member.photoAssetId)) {
      member.photoUrl = urls.get(member.photoAssetId) ?? member.photoUrl;
    }
  });
  payload.events.forEach((event) => {
    if (event.linkedMember?.photoAssetId && urls.has(event.linkedMember.photoAssetId)) {
      event.linkedMember.photoUrl = urls.get(event.linkedMember.photoAssetId) ?? null;
    }
    event.assignees.forEach((assignee) => {
      if (assignee.photoAssetId && urls.has(assignee.photoAssetId)) {
        assignee.photoUrl = urls.get(assignee.photoAssetId) ?? null;
      }
    });
    if (event.image?.id && urls.has(event.image.id)) {
      event.image.url = urls.get(event.image.id) ?? null;
    }
  });
}
