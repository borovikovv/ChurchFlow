import { ForbiddenException } from '@nestjs/common';
import type { OrganizationRole } from '@churchflow/db';
import {
  ORG_PERMISSIONS,
  type KnowledgeAuthor,
  type KnowledgeVisibility,
} from '@churchflow/shared';
import {
  assertOrganizationAccess,
  type OrganizationAccess,
} from '../../common/guards/organization-access.guard';
import type { PrismaService } from '../../prisma/prisma.service';

export interface KnowledgeViewer {
  platformAdmin: boolean;
  role: OrganizationRole | null;
  permissions: string[];
}

export const KNOWLEDGE_AUTHOR_SELECT = {
  select: { id: true, displayName: true, email: true },
} as const;

/**
 * The same boundary the routes enforce, resolved again here because the assistant calls the
 * services directly and visibility depends on the role and permissions it returns.
 */
export function resolveKnowledgeViewer(
  prisma: PrismaService,
  organizationId: string,
  userId: string,
): Promise<OrganizationAccess> {
  return assertOrganizationAccess(prisma, { organizationId, userId });
}

/** Mirrors the route guard: owners and admins always write, members only with knowledge.manage. */
export function canManageKnowledge(viewer: KnowledgeViewer): boolean {
  return (
    viewer.platformAdmin ||
    viewer.role === 'OWNER' ||
    viewer.role === 'ADMIN' ||
    viewer.permissions.includes(ORG_PERMISSIONS.knowledgeManage)
  );
}

/** Every visibility level the viewer may read, applied in every query that returns knowledge. */
export function visibleKnowledgeLevels(viewer: KnowledgeViewer): KnowledgeVisibility[] {
  if (viewer.platformAdmin || viewer.role === 'OWNER') return ['MEMBERS', 'ADMINS', 'OWNER'];
  if (canManageKnowledge(viewer)) return ['MEMBERS', 'ADMINS'];

  return ['MEMBERS'];
}

/** A writer may only hide an entry from others, never from themselves. */
export function assignableKnowledgeLevels(viewer: KnowledgeViewer): KnowledgeVisibility[] {
  return canManageKnowledge(viewer) ? visibleKnowledgeLevels(viewer) : [];
}

export function assertCanWriteKnowledge(
  viewer: KnowledgeViewer,
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
