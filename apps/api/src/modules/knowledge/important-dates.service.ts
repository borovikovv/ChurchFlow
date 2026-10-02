import { Injectable, NotFoundException } from '@nestjs/common';
import {
  importantDateRuleOf,
  nextImportantDateOccurrence,
  type CreateImportantDateInput,
  type ImportantDateItem,
  type ImportantDatesPayload,
  type ListImportantDatesQuery,
  type UpdateImportantDateInput,
} from '@churchflow/shared';
import { assertOrganizationAccess } from '../../common/guards/organization-access.guard';
import { PrismaService } from '../../prisma/prisma.service';
import {
  assertCanWriteKnowledge,
  assignableKnowledgeLevels,
  canManageKnowledge,
  knowledgeAuthor,
  visibleKnowledgeLevels,
} from './knowledge-access';
import {
  ImportantDatesRepository,
  type ImportantDateData,
  type ImportantDateRecord,
} from './repositories/important-dates.repository';

const DATE_NOT_FOUND = 'Important date was not found';

@Injectable()
export class ImportantDatesService {
  constructor(
    private readonly repository: ImportantDatesRepository,
    private readonly prisma: PrismaService,
  ) {}

  /** Soonest first, counted from `today` (YYYY-MM-DD; the current UTC date by default). */
  async list(
    organizationId: string,
    actorUserId: string,
    query: ListImportantDatesQuery,
    today: string = todayUtc(),
  ): Promise<ImportantDatesPayload> {
    const viewer = await assertOrganizationAccess(this.prisma, {
      userId: actorUserId,
      organizationId,
    });
    const dates = await this.repository.list({
      organizationId,
      visibilities: visibleKnowledgeLevels(viewer),
      query,
    });
    const items = dates
      .map((date) => dateToItem(date, today))
      .sort(
        (a, b) =>
          (a.nextDate ?? '9999').localeCompare(b.nextDate ?? '9999') ||
          a.title.localeCompare(b.title),
      );

    return {
      canManage: canManageKnowledge(viewer),
      assignableVisibilities: assignableKnowledgeLevels(viewer),
      items,
    };
  }

  async get(
    organizationId: string,
    dateId: string,
    actorUserId: string,
  ): Promise<ImportantDateItem> {
    const viewer = await assertOrganizationAccess(this.prisma, {
      userId: actorUserId,
      organizationId,
    });
    const date = await this.repository.findVisible({
      organizationId,
      dateId,
      visibilities: visibleKnowledgeLevels(viewer),
    });
    if (!date) throw new NotFoundException(DATE_NOT_FOUND);

    return dateToItem(date, todayUtc());
  }

  async create(
    organizationId: string,
    input: CreateImportantDateInput,
    actorUserId: string,
  ): Promise<ImportantDateItem> {
    const viewer = await assertOrganizationAccess(this.prisma, {
      userId: actorUserId,
      organizationId,
    });
    assertCanWriteKnowledge(viewer, input.visibility);

    const date = await this.repository.create({ organizationId, actorUserId, date: input });

    return dateToItem(date, todayUtc());
  }

  async update(
    organizationId: string,
    dateId: string,
    input: UpdateImportantDateInput,
    actorUserId: string,
  ): Promise<ImportantDateItem> {
    const viewer = await assertOrganizationAccess(this.prisma, {
      userId: actorUserId,
      organizationId,
    });
    assertCanWriteKnowledge(viewer, input.visibility);

    const date = await this.repository.update({
      organizationId,
      dateId,
      actorUserId,
      visibilities: visibleKnowledgeLevels(viewer),
      date: importantDateChanges(input),
    });
    if (!date) throw new NotFoundException(DATE_NOT_FOUND);

    return dateToItem(date, todayUtc());
  }

  async delete(
    organizationId: string,
    dateId: string,
    actorUserId: string,
  ): Promise<{ id: string }> {
    const viewer = await assertOrganizationAccess(this.prisma, {
      userId: actorUserId,
      organizationId,
    });
    assertCanWriteKnowledge(viewer, undefined);

    const deleted = await this.repository.delete({
      organizationId,
      dateId,
      actorUserId,
      visibilities: visibleKnowledgeLevels(viewer),
    });
    if (!deleted) throw new NotFoundException(DATE_NOT_FOUND);

    return deleted;
  }
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * A changed rule replaces the stored one whole, so a date switched from a weekday rule to a fixed
 * day does not keep the weekday it no longer uses.
 */
function importantDateChanges(input: UpdateImportantDateInput): Partial<ImportantDateData> {
  const data: Partial<ImportantDateData> = {};
  if (input.title !== undefined) data.title = input.title;
  if (input.notes !== undefined) data.notes = input.notes;
  if (input.reminderLeadDays !== undefined) data.reminderLeadDays = input.reminderLeadDays;
  if (input.visibility !== undefined) data.visibility = input.visibility;
  if (input.ruleKind !== undefined && input.month !== undefined) {
    const fixed = input.ruleKind === 'FIXED';
    data.ruleKind = input.ruleKind;
    data.month = input.month;
    data.day = fixed ? (input.day ?? null) : null;
    data.weekday = fixed ? null : (input.weekday ?? null);
    data.nth = fixed ? null : (input.nth ?? null);
  }

  return data;
}

function dateToItem(date: ImportantDateRecord, today: string): ImportantDateItem {
  const rule = importantDateRuleOf(date);

  return {
    id: date.id,
    title: date.title,
    notes: date.notes,
    ruleKind: date.ruleKind,
    month: date.month,
    day: date.day,
    weekday: date.weekday,
    nth: date.nth,
    reminderLeadDays: date.reminderLeadDays,
    visibility: date.visibility,
    nextDate: rule ? nextImportantDateOccurrence(rule, today) : null,
    createdBy: knowledgeAuthor(date.createdBy),
    updatedBy: knowledgeAuthor(date.updatedBy),
    createdAt: date.createdAt.toISOString(),
    updatedAt: date.updatedAt.toISOString(),
  };
}
