import { Injectable } from '@nestjs/common';
import type { Prisma } from '@churchflow/db';
import type {
  ImportantDateRuleKind,
  KnowledgeVisibility,
  ListImportantDatesQuery,
} from '@churchflow/shared';
import type { OrganizationAccess } from '../../../common/guards/organization-access.guard';
import { PrismaService } from '../../../prisma/prisma.service';
import { KNOWLEDGE_AUTHOR_SELECT, resolveKnowledgeViewer } from '../knowledge-access';

export const IMPORTANT_DATES_LIST_LIMIT = 200;

const importantDateInclude = {
  createdBy: KNOWLEDGE_AUTHOR_SELECT,
  updatedBy: KNOWLEDGE_AUTHOR_SELECT,
} as const;

export type ImportantDateRecord = Prisma.ImportantDateGetPayload<{
  include: typeof importantDateInclude;
}>;

export interface ImportantDateData {
  title: string;
  notes: string | null;
  ruleKind: ImportantDateRuleKind;
  month: number;
  day: number | null;
  weekday: number | null;
  nth: number | null;
  reminderLeadDays: number | null;
  visibility: KnowledgeVisibility;
}

@Injectable()
export class ImportantDatesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findViewer(organizationId: string, userId: string): Promise<OrganizationAccess> {
    return resolveKnowledgeViewer(this.prisma, organizationId, userId);
  }

  list(input: {
    organizationId: string;
    visibilities: KnowledgeVisibility[];
    query: ListImportantDatesQuery;
  }): Promise<ImportantDateRecord[]> {
    const { q } = input.query;

    return this.prisma.importantDate.findMany({
      where: {
        organizationId: input.organizationId,
        visibility: { in: input.visibilities },
        ...(q
          ? {
              OR: [
                { title: { contains: q, mode: 'insensitive' } },
                { notes: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: importantDateInclude,
      orderBy: [{ month: 'asc' }, { day: 'asc' }, { title: 'asc' }],
      take: IMPORTANT_DATES_LIST_LIMIT,
    });
  }

  findVisible(input: {
    organizationId: string;
    dateId: string;
    visibilities: KnowledgeVisibility[];
  }): Promise<ImportantDateRecord | null> {
    return this.prisma.importantDate.findFirst({
      where: {
        id: input.dateId,
        organizationId: input.organizationId,
        visibility: { in: input.visibilities },
      },
      include: importantDateInclude,
    });
  }

  create(input: {
    organizationId: string;
    actorUserId: string;
    date: ImportantDateData;
  }): Promise<ImportantDateRecord> {
    return this.prisma.$transaction(async (tx) => {
      const date = await tx.importantDate.create({
        data: {
          ...input.date,
          organizationId: input.organizationId,
          createdById: input.actorUserId,
          updatedById: input.actorUserId,
        },
        include: importantDateInclude,
      });

      await tx.auditLog.create({
        data: {
          organizationId: input.organizationId,
          actorUserId: input.actorUserId,
          action: 'CREATE_IMPORTANT_DATE',
          entityType: 'ImportantDate',
          entityId: date.id,
          metadata: { ruleKind: date.ruleKind, visibility: date.visibility },
        },
      });

      return date;
    });
  }

  update(input: {
    organizationId: string;
    dateId: string;
    actorUserId: string;
    visibilities: KnowledgeVisibility[];
    date: Partial<ImportantDateData>;
  }): Promise<ImportantDateRecord | null> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.importantDate.findFirst({
        where: {
          id: input.dateId,
          organizationId: input.organizationId,
          visibility: { in: input.visibilities },
        },
        select: { id: true },
      });
      if (!existing) return null;

      const date = await tx.importantDate.update({
        where: { id: existing.id },
        data: { ...input.date, updatedById: input.actorUserId },
        include: importantDateInclude,
      });

      await tx.auditLog.create({
        data: {
          organizationId: input.organizationId,
          actorUserId: input.actorUserId,
          action: 'UPDATE_IMPORTANT_DATE',
          entityType: 'ImportantDate',
          entityId: date.id,
          metadata: { changedFields: Object.keys(input.date), visibility: date.visibility },
        },
      });

      return date;
    });
  }

  delete(input: {
    organizationId: string;
    dateId: string;
    actorUserId: string;
    visibilities: KnowledgeVisibility[];
  }): Promise<{ id: string } | null> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.importantDate.findFirst({
        where: {
          id: input.dateId,
          organizationId: input.organizationId,
          visibility: { in: input.visibilities },
        },
        select: { id: true, ruleKind: true, visibility: true },
      });
      if (!existing) return null;

      await tx.importantDate.delete({ where: { id: existing.id } });

      await tx.auditLog.create({
        data: {
          organizationId: input.organizationId,
          actorUserId: input.actorUserId,
          action: 'DELETE_IMPORTANT_DATE',
          entityType: 'ImportantDate',
          entityId: existing.id,
          metadata: { ruleKind: existing.ruleKind, visibility: existing.visibility },
        },
      });

      return { id: existing.id };
    });
  }
}
