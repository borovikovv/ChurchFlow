import { Injectable } from '@nestjs/common';
import type { Prisma } from '@churchflow/db';
import type {
  KnowledgeCategory,
  KnowledgeVisibility,
  ListKnowledgeEntriesQuery,
} from '@churchflow/shared';
import { PrismaService } from '../../../prisma/prisma.service';
import { KNOWLEDGE_AUTHOR_SELECT } from './knowledge-author';

/** A list is a reference shelf, not a feed: past this many matches the search should narrow. */
export const KNOWLEDGE_ENTRIES_LIST_LIMIT = 200;

const knowledgeEntryInclude = {
  createdBy: KNOWLEDGE_AUTHOR_SELECT,
  updatedBy: KNOWLEDGE_AUTHOR_SELECT,
} as const;

export type KnowledgeEntryRecord = Prisma.KnowledgeEntryGetPayload<{
  include: typeof knowledgeEntryInclude;
}>;

export interface KnowledgeEntryData {
  title: string;
  content: string;
  category: KnowledgeCategory;
  tags: string[];
  pinned: boolean;
  visibility: KnowledgeVisibility;
}

@Injectable()
export class KnowledgeEntriesRepository {
  constructor(private readonly prisma: PrismaService) {}

  list(input: {
    organizationId: string;
    visibilities: KnowledgeVisibility[];
    query: ListKnowledgeEntriesQuery;
  }): Promise<KnowledgeEntryRecord[]> {
    return this.prisma.knowledgeEntry.findMany({
      where: knowledgeEntriesWhere(input),
      include: knowledgeEntryInclude,
      orderBy: [{ pinned: 'desc' }, { updatedAt: 'desc' }, { id: 'desc' }],
      take: KNOWLEDGE_ENTRIES_LIST_LIMIT,
    });
  }

  async listTags(input: {
    organizationId: string;
    visibilities: KnowledgeVisibility[];
  }): Promise<string[]> {
    const rows = await this.prisma.knowledgeEntry.findMany({
      where: { organizationId: input.organizationId, visibility: { in: input.visibilities } },
      select: { tags: true },
    });

    return [...new Set(rows.flatMap((row) => row.tags))].sort((a, b) => a.localeCompare(b));
  }

  findVisible(input: {
    organizationId: string;
    entryId: string;
    visibilities: KnowledgeVisibility[];
  }): Promise<KnowledgeEntryRecord | null> {
    return this.prisma.knowledgeEntry.findFirst({
      where: {
        id: input.entryId,
        organizationId: input.organizationId,
        visibility: { in: input.visibilities },
      },
      include: knowledgeEntryInclude,
    });
  }

  create(input: {
    organizationId: string;
    actorUserId: string;
    entry: KnowledgeEntryData;
  }): Promise<KnowledgeEntryRecord> {
    return this.prisma.$transaction(async (tx) => {
      const entry = await tx.knowledgeEntry.create({
        data: {
          ...input.entry,
          organizationId: input.organizationId,
          createdById: input.actorUserId,
          updatedById: input.actorUserId,
        },
        include: knowledgeEntryInclude,
      });

      await tx.auditLog.create({
        data: {
          organizationId: input.organizationId,
          actorUserId: input.actorUserId,
          action: 'CREATE_KNOWLEDGE_ENTRY',
          entityType: 'KnowledgeEntry',
          entityId: entry.id,
          metadata: { category: entry.category, visibility: entry.visibility },
        },
      });

      return entry;
    });
  }

  update(input: {
    organizationId: string;
    entryId: string;
    actorUserId: string;
    visibilities: KnowledgeVisibility[];
    entry: Partial<KnowledgeEntryData>;
  }): Promise<KnowledgeEntryRecord | null> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.knowledgeEntry.findFirst({
        where: {
          id: input.entryId,
          organizationId: input.organizationId,
          visibility: { in: input.visibilities },
        },
        select: { id: true },
      });
      if (!existing) return null;

      const entry = await tx.knowledgeEntry.update({
        where: { id: existing.id },
        data: { ...input.entry, updatedById: input.actorUserId },
        include: knowledgeEntryInclude,
      });

      await tx.auditLog.create({
        data: {
          organizationId: input.organizationId,
          actorUserId: input.actorUserId,
          action: 'UPDATE_KNOWLEDGE_ENTRY',
          entityType: 'KnowledgeEntry',
          entityId: entry.id,
          metadata: { changedFields: Object.keys(input.entry), visibility: entry.visibility },
        },
      });

      return entry;
    });
  }

  delete(input: {
    organizationId: string;
    entryId: string;
    actorUserId: string;
    visibilities: KnowledgeVisibility[];
  }): Promise<{ id: string } | null> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.knowledgeEntry.findFirst({
        where: {
          id: input.entryId,
          organizationId: input.organizationId,
          visibility: { in: input.visibilities },
        },
        select: { id: true, category: true, visibility: true },
      });
      if (!existing) return null;

      await tx.knowledgeEntry.delete({ where: { id: existing.id } });

      await tx.auditLog.create({
        data: {
          organizationId: input.organizationId,
          actorUserId: input.actorUserId,
          action: 'DELETE_KNOWLEDGE_ENTRY',
          entityType: 'KnowledgeEntry',
          entityId: existing.id,
          metadata: { category: existing.category, visibility: existing.visibility },
        },
      });

      return { id: existing.id };
    });
  }
}

function knowledgeEntriesWhere(input: {
  organizationId: string;
  visibilities: KnowledgeVisibility[];
  query: ListKnowledgeEntriesQuery;
}): Prisma.KnowledgeEntryWhereInput {
  const { q, category, tag, pinned } = input.query;

  return {
    organizationId: input.organizationId,
    visibility: { in: input.visibilities },
    ...(category ? { category } : {}),
    ...(tag ? { tags: { has: tag } } : {}),
    ...(pinned !== undefined ? { pinned } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { content: { contains: q, mode: 'insensitive' } },
            // Tags are stored lower-cased, so an exact match on the lower-cased term ignores case.
            { tags: { has: q.toLowerCase() } },
          ],
        }
      : {}),
  };
}
