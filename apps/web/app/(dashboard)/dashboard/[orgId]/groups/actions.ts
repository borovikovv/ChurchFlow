'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch } from '@/api/client';
import type {
  AddOrganizationGroupMembersInput,
  CreateOrganizationGroupInput,
  MoveOrganizationGroupMemberInput,
  MoveOrganizationGroupMemberResult,
  OrganizationGroupBoardPayload,
  OrganizationGroupDetail,
  OrganizationGroupDetailPayload,
  OrganizationGroupsPayload,
  SaveOrganizationGroupBoardLayoutInput,
  UpdateOrganizationGroupInput,
  UpdateOrganizationGroupMemberInput,
} from '@churchflow/shared';

function groupsPath(organizationId: string) {
  return `/dashboard/${organizationId}/groups`;
}

function groupPath(organizationId: string, groupId: string) {
  return `${groupsPath(organizationId)}/${groupId}`;
}

function revalidateGroup(organizationId: string, groupId?: string) {
  revalidatePath(groupsPath(organizationId));
  if (groupId) revalidatePath(groupPath(organizationId, groupId));
}

export async function loadGroupsAction(input: { organizationId: string }) {
  const result = await apiFetch<OrganizationGroupsPayload>(
    `/organizations/${input.organizationId}/groups`,
  );

  return result.ok
    ? { ok: true as const, payload: result.data }
    : { ok: false as const, error: result.error.message };
}

export async function loadGroupAction(input: { organizationId: string; groupId: string }) {
  const result = await apiFetch<OrganizationGroupDetailPayload>(
    `/organizations/${input.organizationId}/groups/${input.groupId}`,
  );

  return result.ok
    ? { ok: true as const, payload: result.data }
    : { ok: false as const, error: result.error.message };
}

export async function loadGroupBoardAction(input: { organizationId: string }) {
  const result = await apiFetch<OrganizationGroupBoardPayload>(
    `/organizations/${input.organizationId}/groups/board`,
  );

  return result.ok
    ? { ok: true as const, payload: result.data }
    : { ok: false as const, error: result.error.message };
}

export async function saveGroupBoardLayoutAction(input: {
  organizationId: string;
  layout: SaveOrganizationGroupBoardLayoutInput;
}) {
  const result = await apiFetch<{ saved: number }>(
    `/organizations/${input.organizationId}/groups/board/layout`,
    {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input.layout),
    },
  );

  return result.ok ? { ok: true as const } : { ok: false as const, error: result.error.message };
}

export async function loadGroupDetailsAction(input: { organizationId: string }) {
  const result = await apiFetch<OrganizationGroupDetail[]>(
    `/organizations/${input.organizationId}/groups/details`,
  );

  return result.ok
    ? { ok: true as const, groups: result.data }
    : { ok: false as const, error: result.error.message };
}

export async function createGroupAction(input: {
  organizationId: string;
  group: CreateOrganizationGroupInput;
}) {
  const result = await apiFetch<OrganizationGroupDetail>(
    `/organizations/${input.organizationId}/groups`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input.group),
    },
  );
  revalidateGroup(input.organizationId);

  return result.ok
    ? { ok: true as const, group: result.data }
    : { ok: false as const, error: result.error.message };
}

export async function updateGroupAction(input: {
  organizationId: string;
  groupId: string;
  group: UpdateOrganizationGroupInput;
}) {
  const result = await apiFetch<OrganizationGroupDetail>(
    `/organizations/${input.organizationId}/groups/${input.groupId}`,
    {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input.group),
    },
  );
  revalidateGroup(input.organizationId, input.groupId);

  return result.ok
    ? { ok: true as const, group: result.data }
    : { ok: false as const, error: result.error.message };
}

export async function deleteGroupAction(input: { organizationId: string; groupId: string }) {
  const result = await apiFetch<{ deletedGroupId: string }>(
    `/organizations/${input.organizationId}/groups/${input.groupId}`,
    { method: 'DELETE' },
  );
  revalidateGroup(input.organizationId, input.groupId);

  return result.ok
    ? { ok: true as const, deletedGroupId: result.data.deletedGroupId }
    : { ok: false as const, error: result.error.message };
}

export async function addGroupMembersAction(input: {
  organizationId: string;
  groupId: string;
  members: AddOrganizationGroupMembersInput['members'];
}) {
  const result = await apiFetch<OrganizationGroupDetail>(
    `/organizations/${input.organizationId}/groups/${input.groupId}/members`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ members: input.members }),
    },
  );
  revalidateGroup(input.organizationId, input.groupId);

  return result.ok
    ? { ok: true as const, group: result.data }
    : { ok: false as const, error: result.error.message };
}

export async function updateGroupMemberAction(input: {
  organizationId: string;
  groupId: string;
  membershipId: string;
  member: UpdateOrganizationGroupMemberInput;
}) {
  const result = await apiFetch<OrganizationGroupDetail>(
    `/organizations/${input.organizationId}/groups/${input.groupId}/members/${input.membershipId}`,
    {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input.member),
    },
  );
  revalidateGroup(input.organizationId, input.groupId);

  return result.ok
    ? { ok: true as const, group: result.data }
    : { ok: false as const, error: result.error.message };
}

export async function removeGroupMemberAction(input: {
  organizationId: string;
  groupId: string;
  membershipId: string;
}) {
  const result = await apiFetch<OrganizationGroupDetail>(
    `/organizations/${input.organizationId}/groups/${input.groupId}/members/${input.membershipId}`,
    { method: 'DELETE' },
  );
  revalidateGroup(input.organizationId, input.groupId);

  return result.ok
    ? { ok: true as const, group: result.data }
    : { ok: false as const, error: result.error.message };
}

export async function moveGroupMemberAction(input: {
  organizationId: string;
  groupId: string;
  membershipId: string;
  move: MoveOrganizationGroupMemberInput;
}) {
  const result = await apiFetch<MoveOrganizationGroupMemberResult>(
    `/organizations/${input.organizationId}/groups/${input.groupId}/members/${input.membershipId}/move`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input.move),
    },
  );
  revalidateGroup(input.organizationId, input.groupId);
  revalidatePath(groupPath(input.organizationId, input.move.targetGroupId));

  return result.ok
    ? { ok: true as const, result: result.data }
    : { ok: false as const, error: result.error.message };
}
