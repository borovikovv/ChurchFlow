import { Injectable } from '@nestjs/common';
import type { OrganizationRole, Prisma } from '@churchflow/db';
import type {
  ArchivePrayerRequestInput,
  CreatePrayerRequestInput,
  PrayerRequestTab,
  UpdatePrayerRequestInput,
} from '@churchflow/shared';
import { PrismaService } from '../../../prisma/prisma.service';

const prayerRequestInclude = {
  author: { select: { id: true, displayName: true, email: true } },
  authorMembership: {
    select: {
      id: true,
      userId: true,
      profile: { select: { displayName: true } },
      user: { select: { displayName: true, email: true } },
    },
  },
} as const;

export type PrayerRequestRecord = Prisma.PrayerRequestGetPayload<{
  include: typeof prayerRequestInclude;
}>;

export interface PrayerRequestActor {
  id: string;
  role: OrganizationRole;
}

@Injectable()
export class PrayerRequestsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findActiveMembership(organizationId: string, userId: string): Promise<PrayerRequestActor | null> {
    return this.prisma.organizationMember.findFirst({
      where: {
        organizationId,
        userId,
        status: 'ACTIVE',
        removedAt: null,
        organization: { status: 'ACTIVE', deletedAt: null },
      },
      select: { id: true, role: true },
    });
  }

  async listForOrganization(input: {
    organizationId: string;
    actor: PrayerRequestActor;
    tab: PrayerRequestTab;
    cursor?: string;
    page: number;
    pageSize: number;
  }) {
    const where = prayerRequestVisibleWhere(input);
    const [total, activeCount, archivedCount] = await Promise.all([
      this.prisma.prayerRequest.count({ where }),
      this.prisma.prayerRequest.count({
        where: {
          organizationId: input.organizationId,
          deletedAt: null,
          archivedAt: null,
        },
      }),
      this.prisma.prayerRequest.count({ where: archivedPrayerRequestWhere(input) }),
    ]);
    const pageCount = Math.max(1, Math.ceil(total / input.pageSize));
    const page = input.cursor ? input.page : Math.min(input.page, pageCount);

    const rows = await this.prisma.prayerRequest.findMany({
      where,
      include: prayerRequestInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...(input.cursor
        ? { cursor: { id: input.cursor }, skip: 1 }
        : { skip: (page - 1) * input.pageSize }),
      take: input.pageSize + 1,
    });
    const items = rows.slice(0, input.pageSize);

    return {
      items,
      nextCursor: rows.length > input.pageSize ? (items[input.pageSize - 1]?.id ?? null) : null,
      page,
      total,
      counts: { active: activeCount, archived: archivedCount },
    };
  }

  async create(input: {
    organizationId: string;
    actorUserId: string;
    actor: PrayerRequestActor;
    request: CreatePrayerRequestInput;
  }): Promise<PrayerRequestRecord> {
    return this.prisma.$transaction(async (tx) => {
      const request = await tx.prayerRequest.create({
        data: {
          organizationId: input.organizationId,
          authorUserId: input.actorUserId,
          authorMembershipId: input.actor.id,
          title: input.request.title,
          description: input.request.description,
        },
        include: prayerRequestInclude,
      });

      await tx.auditLog.create({
        data: {
          organizationId: input.organizationId,
          actorUserId: input.actorUserId,
          action: 'CREATE_PRAYER_REQUEST',
          entityType: 'PrayerRequest',
          entityId: request.id,
          metadata: { title: request.title },
        },
      });

      return request;
    });
  }

  async update(input: {
    organizationId: string;
    requestId: string;
    actorUserId: string;
    actor: PrayerRequestActor;
    request: UpdatePrayerRequestInput;
  }): Promise<PrayerRequestRecord | null> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await this.findMutableRequest(tx, input);
      if (!existing) return null;
      const data: Prisma.PrayerRequestUpdateInput = {};
      if (input.request.title !== undefined) data.title = input.request.title;
      if (input.request.description !== undefined) data.description = input.request.description;

      const request = await tx.prayerRequest.update({
        where: { id: existing.id },
        data,
        include: prayerRequestInclude,
      });

      await tx.auditLog.create({
        data: {
          organizationId: input.organizationId,
          actorUserId: input.actorUserId,
          action: 'UPDATE_PRAYER_REQUEST',
          entityType: 'PrayerRequest',
          entityId: request.id,
          metadata: {
            changedFields: Object.keys(input.request),
            authorMembershipId: existing.authorMembershipId,
          },
        },
      });

      return request;
    });
  }

  async archive(input: {
    organizationId: string;
    requestId: string;
    actorUserId: string;
    actor: PrayerRequestActor;
    request: ArchivePrayerRequestInput;
  }): Promise<PrayerRequestRecord | null> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await this.findMutableRequest(tx, input);
      if (!existing) return null;

      const archiveReason = input.request.archiveReason ?? null;
      const request = await tx.prayerRequest.update({
        where: { id: existing.id },
        data: { archivedAt: new Date(), archivedByUserId: input.actorUserId, archiveReason },
        include: prayerRequestInclude,
      });

      await tx.auditLog.create({
        data: {
          organizationId: input.organizationId,
          actorUserId: input.actorUserId,
          action: 'ARCHIVE_PRAYER_REQUEST',
          entityType: 'PrayerRequest',
          entityId: request.id,
          metadata: { authorMembershipId: existing.authorMembershipId, archiveReason },
        },
      });

      return request;
    });
  }

  async restore(input: {
    organizationId: string;
    requestId: string;
    actorUserId: string;
    actor: PrayerRequestActor;
  }): Promise<PrayerRequestRecord | null> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await this.findMutableRequest(tx, input);
      if (!existing) return null;

      const request = await tx.prayerRequest.update({
        where: { id: existing.id },
        data: { archivedAt: null, archivedByUserId: null, archiveReason: null },
        include: prayerRequestInclude,
      });

      await tx.auditLog.create({
        data: {
          organizationId: input.organizationId,
          actorUserId: input.actorUserId,
          action: 'RESTORE_PRAYER_REQUEST',
          entityType: 'PrayerRequest',
          entityId: request.id,
          metadata: { authorMembershipId: existing.authorMembershipId },
        },
      });

      return request;
    });
  }

  async softDelete(input: {
    organizationId: string;
    requestId: string;
    actorUserId: string;
    actor: PrayerRequestActor;
  }): Promise<{ id: string } | null> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await this.findMutableRequest(tx, input);
      if (!existing) return null;

      const request = await tx.prayerRequest.update({
        where: { id: existing.id },
        data: { deletedAt: new Date() },
        select: { id: true },
      });

      await tx.auditLog.create({
        data: {
          organizationId: input.organizationId,
          actorUserId: input.actorUserId,
          action: 'DELETE_PRAYER_REQUEST',
          entityType: 'PrayerRequest',
          entityId: request.id,
          metadata: { authorMembershipId: existing.authorMembershipId },
        },
      });

      return request;
    });
  }

  async listManagerMembershipIds(organizationId: string): Promise<string[]> {
    const memberships = await this.prisma.organizationMember.findMany({
      where: {
        organizationId,
        role: { in: ['OWNER', 'ADMIN'] },
        status: 'ACTIVE',
        removedAt: null,
        userId: { not: null },
        organization: { status: 'ACTIVE', deletedAt: null },
      },
      select: { id: true },
    });

    return memberships.map((membership) => membership.id);
  }

  private findMutableRequest(
    tx: Prisma.TransactionClient,
    input: {
      organizationId: string;
      requestId: string;
      actor: PrayerRequestActor;
    },
  ) {
    return tx.prayerRequest.findFirst({
      where: {
        id: input.requestId,
        organizationId: input.organizationId,
        deletedAt: null,
        ...manageableByActorWhere(input.actor),
      },
      select: {
        id: true,
        authorMembershipId: true,
      },
    });
  }
}

function prayerRequestVisibleWhere(input: {
  organizationId: string;
  actor: PrayerRequestActor;
  tab: PrayerRequestTab;
}): Prisma.PrayerRequestWhereInput {
  if (input.tab === 'archived') return archivedPrayerRequestWhere(input);

  return {
    organizationId: input.organizationId,
    deletedAt: null,
    archivedAt: null,
  };
}

function archivedPrayerRequestWhere(input: {
  organizationId: string;
  actor: PrayerRequestActor;
}): Prisma.PrayerRequestWhereInput {
  return {
    organizationId: input.organizationId,
    deletedAt: null,
    archivedAt: { not: null },
    ...manageableByActorWhere(input.actor),
  };
}

function manageableByActorWhere(actor: PrayerRequestActor): Prisma.PrayerRequestWhereInput {
  return isManagerRole(actor.role) ? {} : { authorMembershipId: actor.id };
}

function isManagerRole(role: OrganizationRole): boolean {
  return role === 'OWNER' || role === 'ADMIN';
}
