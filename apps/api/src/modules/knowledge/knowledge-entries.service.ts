import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  CreateKnowledgeEntryInput,
  KnowledgeEntriesPayload,
  KnowledgeEntryItem,
  ListKnowledgeEntriesQuery,
  UpdateKnowledgeEntryInput,
} from '@churchflow/shared';
import { assertOrganizationAccess } from '../../common/guards/organization-access.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { sanitizeRichText } from '../calendar-events/rich-text/sanitize-rich-text';
import {
  assertCanWriteKnowledge,
  assignableKnowledgeLevels,
  canManageKnowledge,
  knowledgeAuthor,
  visibleKnowledgeLevels,
} from './knowledge-access';
import {
  KnowledgeEntriesRepository,
  type KnowledgeEntryData,
  type KnowledgeEntryRecord,
} from './repositories/knowledge-entries.repository';

const ENTRY_NOT_FOUND = 'Knowledge entry was not found';

@Injectable()
export class KnowledgeEntriesService {
  constructor(
    private readonly repository: KnowledgeEntriesRepository,
    private readonly prisma: PrismaService,
  ) {}

  async list(
    organizationId: string,
    actorUserId: string,
    query: ListKnowledgeEntriesQuery,
  ): Promise<KnowledgeEntriesPayload> {
    const viewer = await assertOrganizationAccess(this.prisma, {
      userId: actorUserId,
      organizationId,
    });
    const visibilities = visibleKnowledgeLevels(viewer);
    const [entries, tags] = await Promise.all([
      this.repository.list({ organizationId, visibilities, query }),
      this.repository.listTags({ organizationId, visibilities }),
    ]);

    return {
      canManage: canManageKnowledge(viewer),
      assignableVisibilities: assignableKnowledgeLevels(viewer),
      tags,
      items: entries.map(entryToItem),
    };
  }

  async get(
    organizationId: string,
    entryId: string,
    actorUserId: string,
  ): Promise<KnowledgeEntryItem> {
    const viewer = await assertOrganizationAccess(this.prisma, {
      userId: actorUserId,
      organizationId,
    });
    const entry = await this.repository.findVisible({
      organizationId,
      entryId,
      visibilities: visibleKnowledgeLevels(viewer),
    });
    if (!entry) throw new NotFoundException(ENTRY_NOT_FOUND);

    return entryToItem(entry);
  }

  async create(
    organizationId: string,
    input: CreateKnowledgeEntryInput,
    actorUserId: string,
  ): Promise<KnowledgeEntryItem> {
    const viewer = await assertOrganizationAccess(this.prisma, {
      userId: actorUserId,
      organizationId,
    });
    assertCanWriteKnowledge(viewer, input.visibility);

    const entry = await this.repository.create({
      organizationId,
      actorUserId,
      entry: { ...input, content: requiredContent(input.content) },
    });

    return entryToItem(entry);
  }

  async update(
    organizationId: string,
    entryId: string,
    input: UpdateKnowledgeEntryInput,
    actorUserId: string,
  ): Promise<KnowledgeEntryItem> {
    const viewer = await assertOrganizationAccess(this.prisma, {
      userId: actorUserId,
      organizationId,
    });
    assertCanWriteKnowledge(viewer, input.visibility);

    const data: Partial<KnowledgeEntryData> = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.content !== undefined) data.content = requiredContent(input.content);
    if (input.category !== undefined) data.category = input.category;
    if (input.tags !== undefined) data.tags = input.tags;
    if (input.pinned !== undefined) data.pinned = input.pinned;
    if (input.visibility !== undefined) data.visibility = input.visibility;

    const entry = await this.repository.update({
      organizationId,
      entryId,
      actorUserId,
      visibilities: visibleKnowledgeLevels(viewer),
      entry: data,
    });
    if (!entry) throw new NotFoundException(ENTRY_NOT_FOUND);

    return entryToItem(entry);
  }

  async delete(
    organizationId: string,
    entryId: string,
    actorUserId: string,
  ): Promise<{ id: string }> {
    const viewer = await assertOrganizationAccess(this.prisma, {
      userId: actorUserId,
      organizationId,
    });
    assertCanWriteKnowledge(viewer, undefined);

    const deleted = await this.repository.delete({
      organizationId,
      entryId,
      actorUserId,
      visibilities: visibleKnowledgeLevels(viewer),
    });
    if (!deleted) throw new NotFoundException(ENTRY_NOT_FOUND);

    return deleted;
  }
}

function requiredContent(content: string): string {
  const sanitized = sanitizeRichText(content);
  if (!sanitized) throw new BadRequestException('Knowledge entry content is required');

  return sanitized;
}

function entryToItem(entry: KnowledgeEntryRecord): KnowledgeEntryItem {
  return {
    id: entry.id,
    title: entry.title,
    content: entry.content,
    category: entry.category,
    tags: entry.tags,
    pinned: entry.pinned,
    visibility: entry.visibility,
    createdBy: knowledgeAuthor(entry.createdBy),
    updatedBy: knowledgeAuthor(entry.updatedBy),
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
  };
}
