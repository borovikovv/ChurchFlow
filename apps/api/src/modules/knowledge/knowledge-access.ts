import { ForbiddenException } from '@nestjs/common';
import {
  ORG_PERMISSIONS,
  type KnowledgeAuthor,
  type KnowledgeVisibility,
} from '@churchflow/shared';
import type { OrganizationAccess } from '../../common/guards/organization-access.guard';

/** Mirrors the route guard: owners and admins always write, members only with knowledge.manage. */
export function canManageKnowledge(viewer: OrganizationAccess): boolean {
  return (
    viewer.platformAdmin ||
    viewer.role === 'OWNER' ||
    viewer.role === 'ADMIN' ||
    viewer.permissions.includes(ORG_PERMISSIONS.knowledgeManage)
  );
}

/** Every visibility level the viewer may read, applied in every query that returns knowledge. */
export function visibleKnowledgeLevels(viewer: OrganizationAccess): KnowledgeVisibility[] {
  if (viewer.platformAdmin || viewer.role === 'OWNER') return ['MEMBERS', 'ADMINS', 'OWNER'];
  if (canManageKnowledge(viewer)) return ['MEMBERS', 'ADMINS'];

  return ['MEMBERS'];
}

/** A writer may only hide an entry from others, never from themselves. */
export function assignableKnowledgeLevels(viewer: OrganizationAccess): KnowledgeVisibility[] {
  return canManageKnowledge(viewer) ? visibleKnowledgeLevels(viewer) : [];
}

export function assertCanWriteKnowledge(
  viewer: OrganizationAccess,
  visibility: KnowledgeVisibility | undefined,
): void {
  if (!canManageKnowledge(viewer)) {
    throw new ForbiddenException('Organization permission is required');
  }

  if (visibility !== undefined && !assignableKnowledgeLevels(viewer).includes(visibility)) {
    throw new ForbiddenException('This visibility is not available to you');
  }
}

export function knowledgeAuthor(
  user: { id: string; displayName: string | null; email: string | null } | null,
): KnowledgeAuthor | null {
  return user ? { userId: user.id, displayName: user.displayName ?? user.email ?? 'Member' } : null;
}
