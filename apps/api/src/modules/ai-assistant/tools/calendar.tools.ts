import { tool } from 'ai';
import { z } from 'zod';
import {
  CALENDAR_EVENT_REMINDERS,
  CALENDAR_EVENT_REPEAT_PERIODS,
  CALENDAR_EVENT_TYPES,
  ENTITLEMENTS,
  createCalendarEventSchema,
  updateCalendarEventSchema,
  type CalendarEventItem,
  type CalendarServiceDetails,
  type CalendarServicePerson,
} from '@churchflow/shared';
import { CalendarEventsController } from '../../calendar-events/calendar-events.controller';
import type { CalendarEventsService } from '../../calendar-events/calendar-events.service';
import {
  zonedDateParts,
  zonedDateTimeToUtc,
} from '../../calendar-events/recurrence/calendar-recurrence';
import { richTextToPlainText } from '../../telegram-bot/rich-text-telegram';
import { jsonInput, localized, type AiToolMeta } from './ai-tool';
import type { AiNameResolver } from './ai-name-resolver';
import type { AiToolRunner } from './ai-tool-runner';

const LIST_RANGE_MAX_DAYS = 62;
const LIST_RESULT_LIMIT = 50;
const UPCOMING_SERVICES_MAX_DAYS = 60;
const DAY_MS = 24 * 60 * 60 * 1000;

export const CALENDAR_TOOL_META = {
  listCalendarEvents: {
    name: 'listCalendarEvents',
    group: 'calendar',
    risk: 'READ',
    policy: {},
    route: { controller: CalendarEventsController, handler: 'list' },
  },
  upcomingServices: {
    name: 'upcomingServices',
    group: 'calendar',
    risk: 'READ',
    policy: {},
    route: { controller: CalendarEventsController, handler: 'list' },
  },
  createCalendarEvent: {
    name: 'createCalendarEvent',
    group: 'calendar',
    risk: 'WRITE',
    policy: { entitlement: ENTITLEMENTS.calendarWrite },
    route: { controller: CalendarEventsController, handler: 'create' },
  },
  updateCalendarEvent: {
    name: 'updateCalendarEvent',
    group: 'calendar',
    risk: 'WRITE',
    policy: { entitlement: ENTITLEMENTS.calendarWrite },
    route: { controller: CalendarEventsController, handler: 'update' },
  },
  deleteCalendarEvent: {
    name: 'deleteCalendarEvent',
    group: 'calendar',
    risk: 'DESTRUCTIVE',
    policy: { entitlement: ENTITLEMENTS.calendarWrite },
    route: { controller: CalendarEventsController, handler: 'delete' },
  },
} satisfies Record<string, AiToolMeta>;

export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .describe('A local date, YYYY-MM-DD.');
const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
  .describe('A local time, HH:mm, 24-hour clock.');
const servicePersonSchema = z
  .object({
    membershipId: z.string().uuid().optional(),
    name: z.string().trim().min(1).max(160).optional().describe('A guest who is not a member.'),
  })
  .describe('A member by membershipId, or a guest by name.');
const serviceDetailsSchema = z.object({
  preacher: servicePersonSchema.optional(),
  worshipLead: servicePersonSchema.optional(),
  serviceHost: servicePersonSchema.optional(),
  communionLead: servicePersonSchema.optional(),
  hasCommunion: z.boolean().optional(),
  biblePassage: z.string().trim().max(180).optional(),
  songs: z.array(z.string().trim().min(1).max(180)).max(30).optional(),
});

export const createCalendarEventInputSchema = z.object({
  type: z.enum(['EVENT', 'SERVICE', 'TASK']),
  title: z.string().trim().min(1).max(180),
  date: dateSchema,
  startTime: timeSchema.optional().describe('Omit for an all-day event.'),
  endTime: timeSchema.optional(),
  description: z.string().trim().max(2000).optional(),
  repeat: z.enum(CALENDAR_EVENT_REPEAT_PERIODS).default('NONE'),
  reminder: z.enum(CALENDAR_EVENT_REMINDERS).optional(),
  assigneeMembershipIds: z
    .array(z.string().uuid())
    .max(20)
    .optional()
    .describe('Required for TASK events.'),
  service: serviceDetailsSchema.optional().describe('Only for SERVICE events.'),
});

export const updateCalendarEventInputSchema = z.object({
  eventId: z.string().uuid().describe('The eventId from listCalendarEvents or upcomingServices.'),
  title: z.string().trim().min(1).max(180).optional(),
  date: dateSchema.optional(),
  startTime: timeSchema.optional(),
  endTime: timeSchema.optional(),
  allDay: z.boolean().optional(),
  description: z.string().trim().max(2000).optional(),
  service: serviceDetailsSchema
    .optional()
    .describe('Only the roles given here change; the rest of the service stays as it is.'),
});

export const deleteCalendarEventInputSchema = z.object({
  eventId: z.string().uuid(),
});

type ServicePersonInput = z.infer<typeof servicePersonSchema>;
type ServiceDetailsInput = z.infer<typeof serviceDetailsSchema>;

interface ServicePersonPayload {
  membershipId?: string;
  customName?: string;
}

export function plainTextToRichText(value: string): string {
  const escaped = value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  return escaped
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, '<br>')}</p>`)
    .join('');
}

function personPayload(person: ServicePersonInput | undefined): ServicePersonPayload | undefined {
  if (!person) return undefined;
  if (person.membershipId) return { membershipId: person.membershipId };
  if (person.name) return { customName: person.name };

  return undefined;
}

function existingPersonPayload(
  person: CalendarServicePerson | null,
): ServicePersonPayload | undefined {
  if (!person) return undefined;
  if (person.membershipId) return { membershipId: person.membershipId };
  if (person.customName) return { customName: person.customName };

  return undefined;
}

/**
 * The service after this change. Service details are replaced as a whole by the API, so every
 * role the user did not mention is carried over from the current event - otherwise "change the
 * preacher" would quietly clear the worship lead.
 */
export function mergeServiceDetails(
  current: CalendarServiceDetails | null,
  change: ServiceDetailsInput,
) {
  const pick = (
    changed: ServicePersonInput | undefined,
    existing: CalendarServicePerson | null | undefined,
  ) => (changed ? personPayload(changed) : existingPersonPayload(existing ?? null));

  return {
    preacher: pick(change.preacher, current?.preacher),
    worshipLead: pick(change.worshipLead, current?.worshipLead),
    serviceHost: pick(change.serviceHost, current?.serviceHost),
    communionLead: pick(change.communionLead, current?.communionLead),
    hasCommunion: change.hasCommunion ?? current?.hasCommunion ?? false,
    biblePassage: change.biblePassage ?? current?.biblePassage ?? null,
    songs: change.songs ?? current?.songs ?? [],
  };
}

function servicePayload(service: ServiceDetailsInput) {
  return mergeServiceDetails(null, service);
}

export function localDateTime(date: string, time: string, timeZone: string): string {
  const [year = 0, month = 1, day = 1] = date.split('-').map(Number);
  const [hour = 0, minute = 0] = time.split(':').map(Number);

  return zonedDateTimeToUtc({ year, month, day, hour, minute, second: 0 }, timeZone).toISOString();
}

export function localParts(value: string, timeZone: string): { date: string; time: string } {
  const parts = zonedDateParts(new Date(value), timeZone);
  const pad = (part: number) => String(part).padStart(2, '0');

  return {
    date: `${String(parts.year)}-${pad(parts.month)}-${pad(parts.day)}`,
    time: `${pad(parts.hour)}:${pad(parts.minute)}`,
  };
}

function personName(person: CalendarServicePerson | null): string | null {
  return person?.displayName ?? null;
}

function eventForModel(event: CalendarEventItem, timeZone: string) {
  const start = localParts(event.startsAt, timeZone);

  return {
    eventId: event.baseEventId,
    type: event.type,
    title: event.title,
    date: start.date,
    time: event.allDay ? null : start.time,
    endsAt: event.endsAt && !event.allDay ? localParts(event.endsAt, timeZone).time : null,
    repeat: event.repeatPeriod,
    description: event.description ? richTextToPlainText(event.description).slice(0, 300) : null,
    service: event.serviceDetails
      ? {
          preacher: personName(event.serviceDetails.preacher),
          worshipLead: personName(event.serviceDetails.worshipLead),
          serviceHost: personName(event.serviceDetails.serviceHost),
          communionLead: personName(event.serviceDetails.communionLead),
          hasCommunion: event.serviceDetails.hasCommunion,
          biblePassage: event.serviceDetails.biblePassage,
          songs: event.serviceDetails.songs,
        }
      : null,
  };
}

function calendarLink(label: string) {
  return { kind: 'calendar' as const, id: null, label };
}

export function calendarTools(runner: AiToolRunner, calendarEventsService: CalendarEventsService) {
  const { organizationId, userId, locale, timeZone, now } = runner.context;

  async function listRange(rangeStart: Date, rangeEnd: Date, types: CalendarEventItem['type'][]) {
    const payload = await calendarEventsService.listForOrganization(organizationId, userId, {
      rangeStart: rangeStart.toISOString(),
      rangeEnd: rangeEnd.toISOString(),
      types,
    });

    // Occurrences come grouped by their base event, so yearly birthdays stored under a birth date
    // would crowd out this month's services if the list were cut before it is put in time order.
    const events = [...payload.events].sort(
      (left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime(),
    );

    return {
      total: events.length,
      truncated: events.length > LIST_RESULT_LIMIT,
      events: events.slice(0, LIST_RESULT_LIMIT).map((event) => eventForModel(event, timeZone)),
    };
  }

  function listedSummary(
    listed: { total: number; truncated: boolean },
    noun: { en: string; uk: string },
  ) {
    return listed.truncated
      ? localized(locale, {
          en: `${String(listed.total)} ${noun.en}; showing the first ${String(LIST_RESULT_LIMIT)}. Ask for a shorter period to see the rest.`,
          uk: `${noun.uk}: ${String(listed.total)}; показано перші ${String(LIST_RESULT_LIMIT)}. Звузьте період, щоб побачити решту.`,
        })
      : localized(locale, {
          en: `${String(listed.total)} ${noun.en}.`,
          uk: `${noun.uk}: ${String(listed.total)}.`,
        });
  }

  return {
    listCalendarEvents: tool({
      description: `List calendar events between two local dates (inclusive, at most ${String(LIST_RANGE_MAX_DAYS)} days). Recurring events appear once per occurrence, all with the same eventId.`,
      inputSchema: z.object({
        from: dateSchema,
        to: dateSchema,
        types: z.array(z.enum(CALENDAR_EVENT_TYPES)).optional(),
      }),
      execute: (input, { toolCallId }) =>
        runner.read(
          CALENDAR_TOOL_META.listCalendarEvents,
          toolCallId,
          jsonInput(input),
          async () => {
            const rangeStart = new Date(localDateTime(input.from, '00:00', timeZone));
            const rangeEnd = new Date(
              new Date(localDateTime(input.to, '00:00', timeZone)).getTime() + DAY_MS,
            );
            if (rangeEnd.getTime() <= rangeStart.getTime()) {
              return {
                ok: false,
                error: localized(locale, {
                  en: 'The end date must not be before the start date.',
                  uk: 'Кінцева дата не може бути раніше початкової.',
                }),
              };
            }
            if (rangeEnd.getTime() - rangeStart.getTime() > LIST_RANGE_MAX_DAYS * DAY_MS) {
              return {
                ok: false,
                error: localized(locale, {
                  en: `Ask for at most ${String(LIST_RANGE_MAX_DAYS)} days at a time.`,
                  uk: `Можна переглянути не більше ${String(LIST_RANGE_MAX_DAYS)} днів за раз.`,
                }),
              };
            }

            const listed = await listRange(
              rangeStart,
              rangeEnd,
              input.types ?? [...CALENDAR_EVENT_TYPES],
            );

            return {
              ok: true,
              summary: listedSummary(listed, { en: 'events', uk: 'Подій' }),
              links: [calendarLink(localized(locale, { en: 'Calendar', uk: 'Календар' }))],
              data: { timeZone, ...listed },
            };
          },
        ),
    }),
    upcomingServices: tool({
      description:
        'The next church services with their preacher, worship lead, host and songs. Use it for questions like "who is preaching this Sunday".',
      inputSchema: z.object({
        days: z.number().int().min(1).max(UPCOMING_SERVICES_MAX_DAYS).default(14),
      }),
      execute: (input, { toolCallId }) =>
        runner.read(CALENDAR_TOOL_META.upcomingServices, toolCallId, jsonInput(input), async () => {
          const listed = await listRange(now, new Date(now.getTime() + input.days * DAY_MS), [
            'SERVICE',
          ]);

          return {
            ok: true,
            summary: listedSummary(listed, {
              en: `services in the next ${String(input.days)} days`,
              uk: `Служінь за наступні ${String(input.days)} днів`,
            }),
            links: [calendarLink(localized(locale, { en: 'Calendar', uk: 'Календар' }))],
            data: {
              timeZone,
              total: listed.total,
              truncated: listed.truncated,
              services: listed.events,
            },
          };
        }),
    }),
    createCalendarEvent: tool({
      description:
        'Create a calendar event, church service or task in local time. Requires confirmation by the user before it runs.',
      inputSchema: createCalendarEventInputSchema,
      execute: (input, { toolCallId }) =>
        runner.mutate(CALENDAR_TOOL_META.createCalendarEvent, toolCallId, async () => {
          const allDay = !input.startTime;
          const event = await calendarEventsService.create(
            organizationId,
            createCalendarEventSchema.parse({
              type: input.type,
              title: input.title,
              description: input.description ? plainTextToRichText(input.description) : null,
              startsAt: localDateTime(input.date, input.startTime ?? '00:00', timeZone),
              endsAt:
                input.endTime && !allDay
                  ? localDateTime(input.date, input.endTime, timeZone)
                  : null,
              allDay,
              repeatPeriod: input.repeat,
              reminder: input.reminder ?? null,
              assigneeMembershipIds: input.assigneeMembershipIds ?? [],
              ...(input.type === 'SERVICE'
                ? { serviceDetails: servicePayload(input.service ?? {}) }
                : {}),
            }),
            userId,
          );

          return {
            ok: true,
            summary: localized(locale, {
              en: `Created "${event.title}".`,
              uk: `Створено «${event.title}».`,
            }),
            links: [calendarLink(event.title)],
          };
        }),
    }),
    updateCalendarEvent: tool({
      description:
        'Change an existing event: title, date, time, description or service roles. For a recurring event this changes the whole series. Requires confirmation by the user before it runs.',
      inputSchema: updateCalendarEventInputSchema,
      execute: (input, { toolCallId }) =>
        runner.mutate(CALENDAR_TOOL_META.updateCalendarEvent, toolCallId, async () => {
          const current = await calendarEventsService.findItem(organizationId, input.eventId);
          const currentStart = localParts(current.startsAt, timeZone);
          const allDay = input.allDay ?? (input.startTime ? false : current.allDay);
          const date = input.date ?? currentStart.date;
          const startsAt = localDateTime(
            date,
            allDay ? '00:00' : (input.startTime ?? currentStart.time),
            timeZone,
          );
          const timingChanged =
            input.date !== undefined || input.startTime !== undefined || input.allDay !== undefined;
          const endsAt = allDay
            ? null
            : input.endTime
              ? localDateTime(date, input.endTime, timeZone)
              : timingChanged && current.endsAt
                ? new Date(
                    new Date(startsAt).getTime() +
                      (new Date(current.endsAt).getTime() - new Date(current.startsAt).getTime()),
                  ).toISOString()
                : undefined;

          const event = await calendarEventsService.update(
            organizationId,
            input.eventId,
            updateCalendarEventSchema.parse({
              ...(input.title !== undefined ? { title: input.title } : {}),
              ...(input.description !== undefined
                ? { description: plainTextToRichText(input.description) }
                : {}),
              ...(timingChanged || input.endTime !== undefined
                ? { startsAt, allDay, ...(endsAt !== undefined ? { endsAt } : {}) }
                : {}),
              ...(input.service
                ? { serviceDetails: mergeServiceDetails(current.serviceDetails, input.service) }
                : {}),
            }),
            userId,
          );

          return {
            ok: true,
            summary: localized(locale, {
              en: `Updated "${event.title}".`,
              uk: `Оновлено «${event.title}».`,
            }),
            links: [calendarLink(event.title)],
          };
        }),
    }),
    deleteCalendarEvent: tool({
      description:
        'Delete an event. For a recurring event this deletes the whole series. Requires confirmation by the user before it runs.',
      inputSchema: deleteCalendarEventInputSchema,
      execute: (input, { toolCallId }) =>
        runner.mutate(CALENDAR_TOOL_META.deleteCalendarEvent, toolCallId, async () => {
          const current = await calendarEventsService.findItem(organizationId, input.eventId);
          await calendarEventsService.delete(organizationId, input.eventId, userId);

          return {
            ok: true,
            summary: localized(locale, {
              en: `Deleted "${current.title}".`,
              uk: `Видалено «${current.title}».`,
            }),
            links: [calendarLink(localized(locale, { en: 'Calendar', uk: 'Календар' }))],
          };
        }),
    }),
  };
}

const DESCRIPTION_EXCERPT_LENGTH = 200;

type ReasonLabel =
  | 'type'
  | 'when'
  | 'ends'
  | 'allDay'
  | 'repeat'
  | 'reminder'
  | 'assignees'
  | 'preacher'
  | 'worshipLead'
  | 'serviceHost'
  | 'communionLead'
  | 'communion'
  | 'biblePassage'
  | 'songs'
  | 'title'
  | 'description';

const REASON_LABELS: Record<ReasonLabel, { en: string; uk: string }> = {
  type: { en: 'Type', uk: 'Тип' },
  when: { en: 'When', uk: 'Коли' },
  ends: { en: 'Ends', uk: 'Закінчення' },
  allDay: { en: 'All day', uk: 'Увесь день' },
  repeat: { en: 'Repeats', uk: 'Повторення' },
  reminder: { en: 'Reminder', uk: 'Нагадування' },
  assignees: { en: 'Assigned to', uk: 'Виконавці' },
  preacher: { en: 'Preacher', uk: 'Проповідник' },
  worshipLead: { en: 'Worship lead', uk: 'Прославлення' },
  serviceHost: { en: 'Host', uk: 'Ведучий' },
  communionLead: { en: 'Communion lead', uk: 'Причастя веде' },
  communion: { en: 'Communion', uk: 'Причастя' },
  biblePassage: { en: 'Bible passage', uk: 'Уривок' },
  songs: { en: 'Songs', uk: 'Пісні' },
  title: { en: 'Title', uk: 'Назва' },
  description: { en: 'Description', uk: 'Опис' },
};

export function excerpt(value: string, length: number): string {
  return value.length > length ? `${value.slice(0, length - 1)}…` : value;
}

/**
 * The confirmation card is the only human check between the model and the calendar, so it lists
 * every argument that changes what happens - who is assigned, how often it repeats, what the
 * description says - not only the title and the time.
 */
export function calendarApprovalReasons(runner: AiToolRunner, names: AiNameResolver) {
  const { locale, timeZone } = runner.context;
  const unknown = localized(locale, { en: 'unknown event', uk: 'невідома подія' });
  const yes = localized(locale, { en: 'yes', uk: 'так' });
  const no = localized(locale, { en: 'no', uk: 'ні' });
  const guest = localized(locale, { en: 'guest', uk: 'гість' });
  const when = (date: string, time: string | undefined) => (time ? `${date} ${time}` : date);
  const line = (label: ReasonLabel, value: string) =>
    `• ${localized(locale, REASON_LABELS[label])}: ${value}`;

  async function personLabel(person: ServicePersonInput): Promise<string> {
    if (person.membershipId) return (await names.memberName(person.membershipId)) ?? unknown;

    return `${person.name ?? ''} (${guest})`;
  }

  async function serviceLines(service: ServiceDetailsInput | undefined): Promise<string[]> {
    if (!service) return [];
    const roles: [ReasonLabel, ServicePersonInput | undefined][] = [
      ['preacher', service.preacher],
      ['worshipLead', service.worshipLead],
      ['serviceHost', service.serviceHost],
      ['communionLead', service.communionLead],
    ];
    const lines = await Promise.all(
      roles.map(async ([label, person]) =>
        person ? line(label, await personLabel(person)) : null,
      ),
    );

    return [
      ...lines.filter((entry): entry is string => entry !== null),
      ...(service.hasCommunion !== undefined
        ? [line('communion', service.hasCommunion ? yes : no)]
        : []),
      ...(service.biblePassage ? [line('biblePassage', service.biblePassage)] : []),
      ...(service.songs && service.songs.length > 0
        ? [line('songs', service.songs.join(', '))]
        : []),
    ];
  }

  return {
    createCalendarEvent: async (input: z.infer<typeof createCalendarEventInputSchema>) => {
      const assignees = await Promise.all(
        (input.assigneeMembershipIds ?? []).map(
          async (membershipId) => (await names.memberName(membershipId)) ?? unknown,
        ),
      );
      const lines = [
        localized(locale, {
          en: `Create "${input.title}".`,
          uk: `Створити «${input.title}».`,
        }),
        line('type', input.type),
        line('when', `${when(input.date, input.startTime)} (${timeZone})`),
        ...(input.startTime ? [] : [line('allDay', yes)]),
        ...(input.endTime && input.startTime ? [line('ends', input.endTime)] : []),
        ...(input.repeat !== 'NONE' ? [line('repeat', input.repeat)] : []),
        ...(input.reminder ? [line('reminder', input.reminder)] : []),
        ...(assignees.length > 0 ? [line('assignees', assignees.join(', '))] : []),
        ...(await serviceLines(input.service)),
        ...(input.description
          ? [line('description', excerpt(input.description, DESCRIPTION_EXCERPT_LENGTH))]
          : []),
      ];

      return lines.join('\n');
    },
    updateCalendarEvent: async (input: z.infer<typeof updateCalendarEventInputSchema>) => {
      const event = await names.event(input.eventId);
      const title = event?.title ?? unknown;
      const lines = [
        localized(locale, { en: `Change "${title}".`, uk: `Змінити «${title}».` }),
        ...(event && event.repeatPeriod !== 'NONE'
          ? [
              localized(locale, {
                en: `• This event repeats (${event.repeatPeriod}): every repeat changes.`,
                uk: `• Подія повторюється (${event.repeatPeriod}): зміниться кожне повторення.`,
              }),
            ]
          : []),
        ...(input.title ? [line('title', input.title)] : []),
        ...(input.date || input.startTime
          ? [line('when', `${when(input.date ?? '', input.startTime).trim()} (${timeZone})`)]
          : []),
        ...(input.endTime ? [line('ends', input.endTime)] : []),
        ...(input.allDay !== undefined ? [line('allDay', input.allDay ? yes : no)] : []),
        ...(await serviceLines(input.service)),
        ...(input.description !== undefined
          ? [line('description', excerpt(input.description, DESCRIPTION_EXCERPT_LENGTH))]
          : []),
      ];

      return lines.join('\n');
    },
    deleteCalendarEvent: async (input: z.infer<typeof deleteCalendarEventInputSchema>) => {
      const title = (await names.event(input.eventId))?.title ?? unknown;

      return localized(locale, {
        en: `Delete "${title}". A recurring event is deleted with all its repeats.`,
        uk: `Видалити «${title}». Подію, що повторюється, буде видалено разом з усіма повтореннями.`,
      });
    },
  };
}
