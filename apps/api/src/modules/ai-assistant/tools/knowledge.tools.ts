import { tool } from 'ai';
import { z } from 'zod';
import {
  CALENDAR_SERVICE_ROLES,
  IMPORTANT_DATE_RULE_KINDS,
  KNOWLEDGE_CATEGORIES,
  KNOWLEDGE_SEARCH_MAX_LENGTH,
  KNOWLEDGE_TAG_MAX_LENGTH,
  KNOWLEDGE_TAGS_MAX_COUNT,
  KNOWLEDGE_VISIBILITIES,
  ORG_PERMISSIONS,
  createImportantDateSchema,
  createKnowledgeEntrySchema,
  importantDateOccurrencesBetween,
  importantDateRuleOf,
  nextImportantDateOccurrence,
  refineImportantDateRule,
  resolveImportantDate,
  type AppLocale,
  type CalendarEventItem,
  type CalendarServiceDetails,
  type CalendarServicePerson,
  type CalendarServiceRole,
  type ImportantDateRule,
  type KnowledgeCategory,
  type KnowledgeEntryItem,
  type KnowledgeVisibility,
  type ListKnowledgeEntriesQuery,
  type OrganizationGroupIcon,
} from '@churchflow/shared';
import type { CalendarEventsService } from '../../calendar-events/calendar-events.service';
import { zonedDateParts } from '../../calendar-events/recurrence/calendar-recurrence';
import type { GroupsService } from '../../groups/groups.service';
import { ImportantDatesController } from '../../knowledge/important-dates.controller';
import type { ImportantDatesService } from '../../knowledge/important-dates.service';
import { KnowledgeEntriesController } from '../../knowledge/knowledge-entries.controller';
import type { KnowledgeEntriesService } from '../../knowledge/knowledge-entries.service';
import type { MembershipsService } from '../../memberships/memberships.service';
import { richTextToPlainText } from '../../telegram-bot/rich-text-telegram';
import { jsonInput, localized, type AiToolMeta } from './ai-tool';
import type { AiToolRunner } from './ai-tool-runner';
import { localDateTime, localParts, plainTextToRichText } from './calendar.tools';

const SEARCH_RESULT_LIMIT = 20;
const EXCERPT_LENGTH = 200;
const CONTENT_MAX_LENGTH = 4000;
const DATE_RANGE_MAX_YEARS = 2;
const DAY_MS = 24 * 60 * 60 * 1000;
const PLANNING_RANGE_MAX_DAYS = 93;
const PLANNING_LOOKBACK_DAYS = 56;
const PLANNING_MEMBERS_LIMIT = 50;
const PLANNING_SERVICES_LIMIT = 60;
const PLANNING_RECENT_LIMIT = 30;
const PLANNING_NOTES_LIMIT = 10;
const PLANNING_EXCERPT_LENGTH = 160;

/**
 * How a service role is planned. Ministries are organization groups now, so a role finds its
 * people through the groups carrying the icon the ministry migration gave them.
 */
const PLANNING_ROLES: Record<
  CalendarServiceRole,
  {
    detailsKey: keyof Pick<
      CalendarServiceDetails,
      'preacher' | 'serviceHost' | 'worshipLead' | 'communionLead'
    >;
    groupIcon: OrganizationGroupIcon;
    noteTag: string;
    noteTerms: readonly string[];
  }
> = {
  PREACHER: {
    detailsKey: 'preacher',
    groupIcon: 'preaching',
    noteTag: 'preaching',
    noteTerms: ['preach', 'пропові'],
  },
  WORSHIP_LEAD: {
    detailsKey: 'worshipLead',
    groupIcon: 'worship',
    noteTag: 'worship',
    noteTerms: ['worship', 'прославл'],
  },
  COMMUNION_LEAD: {
    detailsKey: 'communionLead',
    groupIcon: 'deacons',
    noteTag: 'communion',
    noteTerms: ['communion', 'причаст'],
  },
  // Services are hosted by the church's teachers.
  SERVICE_HOST: {
    detailsKey: 'serviceHost',
    groupIcon: 'teaching',
    noteTag: 'host',
    noteTerms: ['host', 'ведуч'],
  },
};

export const KNOWLEDGE_TOOL_META = {
  searchKnowledge: {
    name: 'searchKnowledge',
    group: 'knowledge',
    risk: 'READ',
    policy: {},
    route: { controller: KnowledgeEntriesController, handler: 'list' },
  },
  getPlanningContext: {
    name: 'getPlanningContext',
    group: 'knowledge',
    risk: 'READ',
    policy: {},
    route: null,
  },
  getKnowledge: {
    name: 'getKnowledge',
    group: 'knowledge',
    risk: 'READ',
    policy: {},
    route: { controller: KnowledgeEntriesController, handler: 'get' },
  },
  listImportantDates: {
    name: 'listImportantDates',
    group: 'knowledge',
    risk: 'READ',
    policy: {},
    route: { controller: ImportantDatesController, handler: 'list' },
  },
  createKnowledge: {
    name: 'createKnowledge',
    group: 'knowledge',
    risk: 'WRITE',
    policy: { permission: ORG_PERMISSIONS.knowledgeManage },
    route: { controller: KnowledgeEntriesController, handler: 'create' },
  },
  createImportantDate: {
    name: 'createImportantDate',
    group: 'knowledge',
    risk: 'WRITE',
    policy: { permission: ORG_PERMISSIONS.knowledgeManage },
    route: { controller: ImportantDatesController, handler: 'create' },
  },
} satisfies Record<string, AiToolMeta>;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

export const createKnowledgeInputSchema = z.object({
  title: z.string().trim().min(2).max(160),
  content: z.string().trim().min(1).max(CONTENT_MAX_LENGTH).describe('Plain text of the note.'),
  category: z.enum(KNOWLEDGE_CATEGORIES).optional(),
  tags: z
    .array(z.string().trim().min(1).max(KNOWLEDGE_TAG_MAX_LENGTH))
    .max(KNOWLEDGE_TAGS_MAX_COUNT)
    .optional(),
  visibility: z
    .enum(KNOWLEDGE_VISIBILITIES)
    .optional()
    .describe('MEMBERS (default), ADMINS (owners and admins) or OWNER (owner only).'),
});

export const createImportantDateInputSchema = z
  .object({
    title: z.string().trim().min(2).max(160),
    notes: z.string().trim().max(2000).optional(),
    ruleKind: z
      .enum(IMPORTANT_DATE_RULE_KINDS)
      .describe('FIXED: the same month and day every year. NTH_WEEKDAY: e.g. the first Sunday.'),
    month: z.number().int().min(1).max(12),
    day: z.number().int().min(1).max(31).optional().describe('FIXED only.'),
    weekday: z.number().int().min(0).max(6).optional().describe('NTH_WEEKDAY only; 0 is Sunday.'),
    nth: z
      .union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(-1)])
      .optional()
      .describe('NTH_WEEKDAY only: 1-4, or -1 for the last one in the month.'),
    reminderLeadDays: z.number().int().min(0).max(60).optional(),
    visibility: z.enum(KNOWLEDGE_VISIBILITIES).optional(),
  })
  .superRefine(refineImportantDateRule);

export function knowledgeTools(
  runner: AiToolRunner,
  services: {
    knowledgeEntriesService: KnowledgeEntriesService;
    importantDatesService: ImportantDatesService;
    membershipsService: MembershipsService;
    groupsService: GroupsService;
    calendarEventsService: CalendarEventsService;
  },
) {
  const { organizationId, userId, locale, timeZone, now } = runner.context;
  const {
    knowledgeEntriesService,
    importantDatesService,
    membershipsService,
    groupsService,
    calendarEventsService,
  } = services;
  const knowledgeLink = {
    kind: 'knowledge' as const,
    id: null,
    label: localized(locale, { en: 'Knowledge', uk: 'Знання' }),
  };
  const datesLink = {
    kind: 'importantDates' as const,
    id: null,
    label: localized(locale, { en: 'Important dates', uk: 'Важливі дати' }),
  };
  const today = localToday(now, timeZone);

  return {
    searchKnowledge: tool({
      description:
        "Search the church's knowledge base: notes on its traditions, instructions, agreements, ministries and beliefs. Consult it whenever an answer depends on how this church does things. Returns titles and short excerpts; read a whole note with getKnowledge.",
      inputSchema: z.object({
        query: z.string().trim().max(KNOWLEDGE_SEARCH_MAX_LENGTH).optional(),
        category: z.enum(KNOWLEDGE_CATEGORIES).optional(),
        tag: z.string().trim().max(KNOWLEDGE_TAG_MAX_LENGTH).optional(),
      }),
      execute: (input, { toolCallId }) =>
        runner.read(KNOWLEDGE_TOOL_META.searchKnowledge, toolCallId, jsonInput(input), async () => {
          const payload = await knowledgeEntriesService.list(organizationId, userId, {
            q: input.query || undefined,
            category: input.category,
            tag: input.tag ? input.tag.toLowerCase() : undefined,
            pinned: undefined,
          });
          const entries = payload.items.slice(0, SEARCH_RESULT_LIMIT);

          return {
            ok: true,
            summary: localized(locale, {
              en: `${String(payload.items.length)} knowledge notes found.`,
              uk: `Знайдено нотаток: ${String(payload.items.length)}.`,
            }),
            links: [knowledgeLink],
            data: {
              total: payload.items.length,
              entries: entries.map((entry) => ({
                id: entry.id,
                title: entry.title,
                category: entry.category,
                tags: entry.tags,
                pinned: entry.pinned,
                excerpt: excerpt(richTextToPlainText(entry.content), EXCERPT_LENGTH),
                updatedAt: entry.updatedAt.slice(0, 10),
              })),
            },
          };
        }),
    }),
    getKnowledge: tool({
      description: 'The full text of one knowledge note, by the id searchKnowledge returned.',
      inputSchema: z.object({ id: z.string().uuid() }),
      execute: (input, { toolCallId }) =>
        runner.read(KNOWLEDGE_TOOL_META.getKnowledge, toolCallId, jsonInput(input), async () => {
          const entry = await knowledgeEntriesService.get(organizationId, input.id, userId);

          return {
            ok: true,
            summary: localized(locale, {
              en: 'Read one knowledge note.',
              uk: 'Прочитано одну нотатку.',
            }),
            links: [{ ...knowledgeLink, label: entry.title }],
            data: {
              id: entry.id,
              title: entry.title,
              category: entry.category,
              tags: entry.tags,
              content: excerpt(richTextToPlainText(entry.content), CONTENT_MAX_LENGTH),
              updatedAt: entry.updatedAt.slice(0, 10),
              updatedBy: entry.updatedBy?.displayName ?? null,
            },
          };
        }),
    }),
    listImportantDates: tool({
      description:
        "The church's yearly important dates (anniversaries, Thanksgiving and other days it keeps), each resolved to a concrete date. Without arguments it gives the next occurrence of each; pass a year, or a from/to range of at most two years.",
      inputSchema: z.object({
        year: z.number().int().min(1900).max(2200).optional(),
        from: isoDate.optional(),
        to: isoDate.optional(),
      }),
      execute: (input, { toolCallId }) =>
        runner.read(
          KNOWLEDGE_TOOL_META.listImportantDates,
          toolCallId,
          jsonInput(input),
          async () => {
            const occurrences = occurrencesFor(input, today);
            if (!occurrences.ok) return occurrences;

            const payload = await importantDatesService.list(organizationId, userId, {}, today);
            const dates = payload.items.flatMap((item) => {
              const rule = importantDateRuleOf(item);
              if (!rule) return [];

              return [
                {
                  id: item.id,
                  title: item.title,
                  rule: describeImportantDateRule(rule, 'en'),
                  dates: occurrences.resolve(rule),
                  notes: item.notes,
                },
              ];
            });

            return {
              ok: true,
              summary: localized(locale, {
                en: `${String(dates.length)} important dates.`,
                uk: `Важливих дат: ${String(dates.length)}.`,
              }),
              links: [datesLink],
              data: { today, dates },
            };
          },
        ),
    }),
    getPlanningContext: tool({
      description: `Everything needed to plan who serves in a service role over a period, e.g. "make a preaching schedule for November" or "склади графік проповідників на листопад": the people in the ministry group, the services in the period and who is already assigned, the assignments of the previous 8 weeks for a fair rotation, the important dates in the period and the church's notes on this ministry (its rules, rotations and preferences). Call it before proposing a rota or saying who should serve; the user does not have to mention the knowledge base. role: PREACHER (preachers group), WORSHIP_LEAD (worship group), COMMUNION_LEAD (deacons group), SERVICE_HOST (the host, from the teachers group). Pass groupId from listGroups to take the candidates from another group. Local dates, at most ${String(PLANNING_RANGE_MAX_DAYS)} days. It only reads; changes to services go through updateCalendarEvent.`,
      inputSchema: z.object({
        role: z.enum(CALENDAR_SERVICE_ROLES),
        from: isoDate,
        to: isoDate,
        groupId: z
          .string()
          .uuid()
          .optional()
          .describe('A group whose members are the candidates, from listGroups.'),
      }),
      execute: (input, { toolCallId }) =>
        runner.read(
          KNOWLEDGE_TOOL_META.getPlanningContext,
          toolCallId,
          jsonInput(input),
          async () => {
            const days = daysBetween(input.from, input.to);
            if (days === null || days < 0 || days >= PLANNING_RANGE_MAX_DAYS) {
              return {
                ok: false,
                error: localized(locale, {
                  en: `Use real dates where the end is not before the start, at most ${String(PLANNING_RANGE_MAX_DAYS)} days in all.`,
                  uk: `Вкажіть справжні дати: кінець не раніше початку, загалом не більше ${String(PLANNING_RANGE_MAX_DAYS)} днів.`,
                }),
              };
            }

            const plan = PLANNING_ROLES[input.role];
            const groupsPayload = await groupsService.listForOrganization(organizationId, userId);
            const groups = groupsPayload.groups.filter((group) =>
              input.groupId ? group.id === input.groupId : group.icon === plan.groupIcon,
            );
            const lookbackFrom = shiftDate(input.from, -PLANNING_LOOKBACK_DAYS);
            const [members, calendar, dates, notes] = await Promise.all([
              groups.length > 0
                ? membershipsService.listForOrganization(
                    organizationId,
                    userId,
                    'all',
                    'active',
                    'all',
                    '',
                    groups.map((group) => group.id),
                    1,
                    PLANNING_MEMBERS_LIMIT,
                  )
                : null,
              calendarEventsService.listForOrganization(organizationId, userId, {
                rangeStart: localDateTime(lookbackFrom, '00:00', timeZone),
                rangeEnd: new Date(
                  new Date(localDateTime(input.to, '00:00', timeZone)).getTime() + DAY_MS,
                ).toISOString(),
                types: ['SERVICE'],
              }),
              importantDatesService.list(organizationId, userId, {}, today),
              Promise.all(
                planningNoteQueries(plan).map((query) =>
                  knowledgeEntriesService.list(organizationId, userId, query),
                ),
              ),
            ]);

            const candidates = (members?.members ?? [])
              .filter((member) => member.status === 'ACTIVE')
              .map((member) => ({ membershipId: member.id, name: member.profile.displayName }));
            const services = [...calendar.events]
              .sort(
                (left, right) =>
                  new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime(),
              )
              .map((event) => serviceAssignment(event, plan.detailsKey, timeZone));
            const inRange = services.filter((service) => service.date >= input.from);
            const recent = services.filter(
              (service) => service.date < input.from && service.assignee !== null,
            );
            const importantDates = dates.items.flatMap((item) => {
              const rule = importantDateRuleOf(item);
              const occurrences = rule
                ? importantDateOccurrencesBetween(rule, input.from, input.to)
                : [];

              return occurrences.length > 0
                ? [{ id: item.id, title: item.title, dates: occurrences }]
                : [];
            });
            const relevantNotes = uniqueEntries(notes.flatMap((payload) => payload.items))
              .slice(0, PLANNING_NOTES_LIMIT)
              .map((entry) => ({
                id: entry.id,
                title: entry.title,
                excerpt: excerpt(richTextToPlainText(entry.content), PLANNING_EXCERPT_LENGTH),
              }));

            return {
              ok: true,
              summary: localized(locale, {
                en: `${String(candidates.length)} candidates, ${String(inRange.length)} services, ${String(recent.length)} recent assignments, ${String(importantDates.length)} important dates, ${String(relevantNotes.length)} notes.`,
                uk: `Кандидатів: ${String(candidates.length)}, служінь: ${String(inRange.length)}, нещодавніх призначень: ${String(recent.length)}, важливих дат: ${String(importantDates.length)}, нотаток: ${String(relevantNotes.length)}.`,
              }),
              links: [knowledgeLink],
              data: {
                role: input.role,
                from: input.from,
                to: input.to,
                groups: groups.map((group) => ({ groupId: group.id, name: group.name })),
                candidates,
                candidatesTruncated: (members?.pagination.total ?? 0) > PLANNING_MEMBERS_LIMIT,
                hint:
                  groups.length === 0
                    ? 'No group serves in this role. Ask the user which group does and call again with its groupId from listGroups.'
                    : null,
                services: inRange.slice(0, PLANNING_SERVICES_LIMIT),
                servicesTruncated: inRange.length > PLANNING_SERVICES_LIMIT,
                recentAssignments: recent.slice(-PLANNING_RECENT_LIMIT),
                importantDates,
                notes: relevantNotes,
              },
            };
          },
        ),
    }),
    createKnowledge: tool({
      description:
        'Save a note to the church knowledge base. Only when the user explicitly asks to remember, save or write something down - never on your own initiative. Requires confirmation by the user before it runs.',
      inputSchema: createKnowledgeInputSchema,
      execute: (input, { toolCallId }) =>
        runner.mutate(KNOWLEDGE_TOOL_META.createKnowledge, toolCallId, async () => {
          await knowledgeEntriesService.create(
            organizationId,
            createKnowledgeEntrySchema.parse({
              ...input,
              content: plainTextToRichText(input.content),
            }),
            userId,
          );

          return {
            ok: true,
            summary: localized(locale, {
              en: 'The note was saved.',
              uk: 'Нотатку збережено.',
            }),
            links: [knowledgeLink],
          };
        }),
    }),
    createImportantDate: tool({
      description:
        'Save a date the church keeps every year, e.g. Thanksgiving on the first Sunday of October (NTH_WEEKDAY, month 10, weekday 0, nth 1). Only when the user explicitly asks to remember or save it. It is not added to the calendar. Requires confirmation by the user before it runs.',
      inputSchema: createImportantDateInputSchema,
      execute: (input, { toolCallId }) =>
        runner.mutate(KNOWLEDGE_TOOL_META.createImportantDate, toolCallId, async () => {
          await importantDatesService.create(
            organizationId,
            createImportantDateSchema.parse(input),
            userId,
          );

          return {
            ok: true,
            summary: localized(locale, {
              en: 'The important date was saved.',
              uk: 'Важливу дату збережено.',
            }),
            links: [datesLink],
          };
        }),
    }),
  };
}

function localToday(now: Date, timeZone: string): string {
  const parts = zonedDateParts(now, timeZone);
  const pad = (part: number) => String(part).padStart(2, '0');

  return `${String(parts.year)}-${pad(parts.month)}-${pad(parts.day)}`;
}

function occurrencesFor(
  input: { year?: number | undefined; from?: string | undefined; to?: string | undefined },
  today: string,
): { ok: true; resolve: (rule: ImportantDateRule) => string[] } | { ok: false; error: string } {
  if (input.year !== undefined) {
    const year = input.year;
    return { ok: true, resolve: (rule) => [resolveImportantDate(rule, year)] };
  }

  if (input.from !== undefined || input.to !== undefined) {
    const from = input.from ?? today;
    const to = input.to ?? from;
    if (to < from || Number(to.slice(0, 4)) - Number(from.slice(0, 4)) > DATE_RANGE_MAX_YEARS) {
      return {
        ok: false,
        error: 'Use a range that ends after it starts and spans at most two years.',
      };
    }

    return { ok: true, resolve: (rule) => importantDateOccurrencesBetween(rule, from, to) };
  }

  return { ok: true, resolve: (rule) => [nextImportantDateOccurrence(rule, today)] };
}

/**
 * The notes a plan for this role should respect: the ones about the role itself first, then the
 * church's ministry notes and what it pinned. Each search applies the viewer's visibility.
 */
function planningNoteQueries(
  plan: (typeof PLANNING_ROLES)[CalendarServiceRole],
): ListKnowledgeEntriesQuery[] {
  const none = { q: undefined, category: undefined, tag: undefined, pinned: undefined };

  return [
    { ...none, tag: plan.noteTag },
    ...plan.noteTerms.map((term) => ({ ...none, q: term })),
    { ...none, category: 'MINISTRY' },
    { ...none, pinned: true },
  ];
}

function serviceAssignment(
  event: CalendarEventItem,
  detailsKey: (typeof PLANNING_ROLES)[CalendarServiceRole]['detailsKey'],
  timeZone: string,
) {
  const person: CalendarServicePerson | null = event.serviceDetails?.[detailsKey] ?? null;

  return {
    date: localParts(event.startsAt, timeZone).date,
    eventId: event.baseEventId,
    title: event.title,
    assignee: person ? { membershipId: person.membershipId, name: person.displayName } : null,
  };
}

/** Notes found by several searches appear once, where the first search found them. */
function uniqueEntries(entries: KnowledgeEntryItem[]): KnowledgeEntryItem[] {
  const seen = new Set<string>();

  return entries.filter((entry) => {
    if (seen.has(entry.id)) return false;
    seen.add(entry.id);
    return true;
  });
}

function dateValue(date: string): number | null {
  const value = Date.parse(`${date}T00:00:00.000Z`);

  return Number.isNaN(value) || new Date(value).toISOString().slice(0, 10) !== date ? null : value;
}

/** Whole days from one YYYY-MM-DD date to another, or null when either is not a real date. */
function daysBetween(from: string, to: string): number | null {
  const start = dateValue(from);
  const end = dateValue(to);

  return start === null || end === null ? null : Math.round((end - start) / DAY_MS);
}

function shiftDate(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00.000Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

function excerpt(value: string, length: number): string {
  return value.length > length ? `${value.slice(0, length - 1)}…` : value;
}

const MONTHS: Record<AppLocale, readonly string[]> = {
  en: [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ],
  // Genitive, as in "7 січня" and "першу неділю жовтня".
  uk: [
    'січня',
    'лютого',
    'березня',
    'квітня',
    'травня',
    'червня',
    'липня',
    'серпня',
    'вересня',
    'жовтня',
    'листопада',
    'грудня',
  ],
};

const WEEKDAYS: Record<AppLocale, readonly string[]> = {
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  // Accusative, as in "у першу неділю".
  uk: ['неділю', 'понеділок', 'вівторок', 'середу', 'четвер', 'пʼятницю', 'суботу'],
};

const ORDINALS: Record<AppLocale, Record<string, string>> = {
  en: { '1': 'first', '2': 'second', '3': 'third', '4': 'fourth', '-1': 'last' },
  uk: { '1': 'перш', '2': 'друг', '3': 'трет', '4': 'четверт', '-1': 'останн' },
};

/** Ukrainian ordinals agree with the weekday: "перший понеділок", "першу неділю", "перше". */
function ukOrdinal(stem: string, weekday: number): string {
  const masculine = weekday === 1 || weekday === 2 || weekday === 4;
  if (stem === 'трет') return masculine ? 'третій' : 'третю';
  if (stem === 'останн') return masculine ? 'останній' : 'останню';

  return masculine ? `${stem}ий` : `${stem}у`;
}

export function describeImportantDateRule(rule: ImportantDateRule, locale: AppLocale): string {
  const month = MONTHS[locale][rule.month - 1] ?? String(rule.month);
  if (rule.ruleKind === 'FIXED') {
    return localized(locale, {
      en: `every year on ${String(rule.day)} ${month}`,
      uk: `щороку ${String(rule.day)} ${month}`,
    });
  }

  const weekday = WEEKDAYS[locale][rule.weekday] ?? String(rule.weekday);
  const ordinal = ORDINALS[locale][String(rule.nth)] ?? String(rule.nth);
  if (locale === 'uk') {
    return `щороку в ${ukOrdinal(ordinal, rule.weekday)} ${weekday} ${month}`;
  }

  return `every year on the ${ordinal} ${weekday} of ${month}`;
}

const CATEGORY_LABELS: Record<KnowledgeCategory, Record<AppLocale, string>> = {
  TRADITION: { en: 'tradition', uk: 'традиція' },
  INSTRUCTION: { en: 'instruction', uk: 'інструкція' },
  AGREEMENT: { en: 'agreement', uk: 'домовленість' },
  MINISTRY: { en: 'ministry', uk: 'служіння' },
  THEOLOGY: { en: 'theology', uk: 'богословʼя' },
  OTHER: { en: 'other', uk: 'інше' },
};

const VISIBILITY_LABELS: Record<KnowledgeVisibility, Record<AppLocale, string>> = {
  MEMBERS: { en: 'all members', uk: 'усі учасники' },
  ADMINS: { en: 'owners and admins', uk: 'власник і адміністратори' },
  OWNER: { en: 'the owner only', uk: 'лише власник' },
};

export function knowledgeApprovalReasons(runner: AiToolRunner) {
  const { locale, timeZone, now } = runner.context;
  const visibleTo = (visibility: KnowledgeVisibility | undefined) =>
    VISIBILITY_LABELS[visibility ?? 'MEMBERS'][locale];

  return {
    // The card shows what will be stored and who will read it, since a note outlives the chat.
    createKnowledge: (input: z.infer<typeof createKnowledgeInputSchema>) => {
      const category = CATEGORY_LABELS[input.category ?? 'OTHER'][locale];
      const text = excerpt(input.content, EXCERPT_LENGTH);

      return localized(locale, {
        en: `Save the note "${input.title}" to the knowledge base (${category}, visible to ${visibleTo(input.visibility)}).\n${text}`,
        uk: `Зберегти нотатку «${input.title}» у базі знань (${category}, бачать: ${visibleTo(input.visibility)}).\n${text}`,
      });
    },
    createImportantDate: (input: z.infer<typeof createImportantDateInputSchema>) => {
      const rule = importantDateRuleOf({
        ruleKind: input.ruleKind,
        month: input.month,
        day: input.day ?? null,
        weekday: input.weekday ?? null,
        nth: input.nth ?? null,
      });
      const when = rule
        ? `${describeImportantDateRule(rule, locale)} (${localized(locale, { en: 'next', uk: 'наступна' })}: ${nextImportantDateOccurrence(rule, localToday(now, timeZone))})`
        : localized(locale, { en: 'incomplete date rule', uk: 'неповне правило дати' });

      return localized(locale, {
        en: `Save the important date "${input.title}": ${when}. Visible to ${visibleTo(input.visibility)}. It will not be added to the calendar.`,
        uk: `Зберегти важливу дату «${input.title}»: ${when}. Бачать: ${visibleTo(input.visibility)}. До календаря її не буде додано.`,
      });
    },
  };
}
