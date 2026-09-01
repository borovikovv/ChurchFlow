import { z } from 'zod';
import type { AppLocale } from '@churchflow/shared';
import { formatDateTime } from '../../common/time/date-time';

export const NOTIFICATION_TITLE_KEYS = [
  'anniversary',
  'birthday',
  'birthdayDigestAnniversaries',
  'birthdayDigestBirthdays',
  'birthdayDigestBirthdaysAndAnniversaries',
  'calendarEvent',
  'calendarEventLinked',
  'calendarReminder',
  'memberAdded',
  'memberRemoved',
  'membersImported',
  'prayerRequestCreated',
  'serviceAssigned',
  'serviceReminder',
  'serviceStarts',
  'subscriptionPaymentFailed',
  'subscriptionRenewed',
  'subscriptionRequired',
  'subscriptionRestricted',
  'taskAssigned',
  'taskDue',
  'taskReminder',
] as const;

export type NotificationTitleKey = (typeof NOTIFICATION_TITLE_KEYS)[number];

const eventTimeParamsShape = {
  eventTitle: z.string(),
  startsAt: z.string(),
  timeZone: z.string(),
};

export const notificationBodyMessageSchema = z.discriminatedUnion('key', [
  z.object({ key: z.literal('eventStartsAt'), ...eventTimeParamsShape }),
  z.object({ key: z.literal('eventScheduledFor'), ...eventTimeParamsShape }),
  z.object({
    key: z.literal('calendarEventLinked'),
    memberName: z.string().nullable(),
    ...eventTimeParamsShape,
  }),
  z.object({ key: z.literal('memberAdded'), memberName: z.string().nullable() }),
  z.object({ key: z.literal('memberRemoved'), memberName: z.string().nullable() }),
  z.object({ key: z.literal('membersImported'), memberCount: z.number().int() }),
  z.object({
    key: z.literal('prayerRequestCreated'),
    authorName: z.string().nullable(),
    requestTitle: z.string(),
  }),
  z.object({
    key: z.literal('birthdayDigest'),
    birthdays: z.array(z.string()),
    anniversaries: z.array(z.string()),
  }),
  z.object({ key: z.literal('subscriptionDeadline'), deadline: z.string(), timeZone: z.string() }),
  z.object({ key: z.literal('subscriptionRestricted') }),
  z.object({
    key: z.literal('subscriptionRenewed'),
    nextChargeAt: z.string(),
    timeZone: z.string(),
  }),
]);

export type NotificationBodyMessage = z.infer<typeof notificationBodyMessageSchema>;

interface EventTimeTexts {
  eventTitle: string;
  startsAt: string;
}

interface NotificationMessageCatalog {
  intlLocale: string;
  titles: Record<NotificationTitleKey, string>;
  bodies: {
    birthdayDigest: (params: { birthdays: string[]; anniversaries: string[] }) => string;
    calendarEventLinked: (params: EventTimeTexts & { memberName: string }) => string;
    eventScheduledFor: (params: EventTimeTexts) => string;
    eventStartsAt: (params: EventTimeTexts) => string;
    memberAdded: (params: { memberName: string }) => string;
    memberRemoved: (params: { memberName: string }) => string;
    membersImported: (params: { memberCount: number }) => string;
    prayerRequestCreated: (params: { authorName: string; requestTitle: string }) => string;
    subscriptionDeadline: (params: { deadline: string }) => string;
    subscriptionRenewed: (params: { nextChargeAt: string }) => string;
    subscriptionRestricted: () => string;
  };
  platformAdmin: {
    organizationRequestBody: (params: {
      contactName: string;
      contactEmail: string | null;
    }) => string;
    organizationRequestTitle: (params: { organizationName: string }) => string;
  };
  unknownMember: string;
}

const NOTIFICATION_MESSAGE_CATALOG = {
  en: {
    intlLocale: 'en-US',
    titles: {
      anniversary: 'Anniversary',
      birthday: 'Birthday',
      birthdayDigestAnniversaries: 'Anniversaries today',
      birthdayDigestBirthdays: 'Birthdays today',
      birthdayDigestBirthdaysAndAnniversaries: 'Birthdays and anniversaries today',
      calendarEvent: 'Calendar event',
      calendarEventLinked: 'Calendar event linked to member',
      calendarReminder: 'Calendar reminder',
      memberAdded: 'Member added',
      memberRemoved: 'Member removed',
      membersImported: 'Members imported',
      prayerRequestCreated: 'New prayer request',
      serviceAssigned: 'You were assigned to a service',
      serviceReminder: 'Service reminder',
      serviceStarts: 'Service starts',
      subscriptionPaymentFailed: 'Subscription payment failed',
      subscriptionRenewed: 'Subscription renewed',
      subscriptionRequired: 'A subscription is required',
      subscriptionRestricted: 'Organization is now read-only',
      taskAssigned: 'You were assigned a task',
      taskDue: 'Task due',
      taskReminder: 'Task reminder',
    },
    bodies: {
      birthdayDigest: (params) =>
        [
          milestoneSection('Birthdays', params.birthdays),
          milestoneSection('Anniversaries', params.anniversaries),
        ]
          .filter((section): section is string => Boolean(section))
          .join('\n'),
      calendarEventLinked: (params) =>
        `${params.memberName} was linked to ${params.eventTitle}, starting at ${params.startsAt}.`,
      eventScheduledFor: (params) => `${params.eventTitle} is scheduled for ${params.startsAt}.`,
      eventStartsAt: (params) => `${params.eventTitle} starts at ${params.startsAt}.`,
      memberAdded: (params) => `${params.memberName} was added to the organization.`,
      memberRemoved: (params) => `${params.memberName} was removed from the organization.`,
      membersImported: (params) =>
        `${String(params.memberCount)} members were imported to the organization.`,
      prayerRequestCreated: (params) =>
        `${params.authorName} asked for prayer: ${params.requestTitle}`,
      subscriptionDeadline: (params) =>
        `Full access continues until ${params.deadline}. After that the organization becomes read-only: existing data stays readable, but nothing new can be created.`,
      subscriptionRenewed: (params) =>
        `The payment went through. The next charge is on ${params.nextChargeAt}.`,
      subscriptionRestricted: () =>
        'The organization is now read-only. Existing members, events, prayer requests, pages and files stay readable; creating and editing resumes as soon as a payment succeeds.',
    },
    platformAdmin: {
      organizationRequestBody: (params) =>
        `Contact: ${params.contactName}${params.contactEmail ? ` <${params.contactEmail}>` : ''}`,
      organizationRequestTitle: (params) => `New organization request: ${params.organizationName}`,
    },
    unknownMember: 'A member',
  },
  uk: {
    intlLocale: 'uk-UA',
    titles: {
      anniversary: 'Річниця',
      birthday: 'День народження',
      birthdayDigestAnniversaries: 'Сьогодні річниці',
      birthdayDigestBirthdays: 'Сьогодні дні народження',
      birthdayDigestBirthdaysAndAnniversaries: 'Сьогодні дні народження та річниці',
      calendarEvent: 'Подія календаря',
      calendarEventLinked: 'Подію календаря прив’язано до учасника',
      calendarReminder: 'Нагадування з календаря',
      memberAdded: 'Додано учасника',
      memberRemoved: 'Учасника видалено',
      membersImported: 'Учасників імпортовано',
      prayerRequestCreated: 'Нова молитовна потреба',
      serviceAssigned: 'Вас призначено на служіння',
      serviceReminder: 'Нагадування про служіння',
      serviceStarts: 'Початок служіння',
      subscriptionPaymentFailed: 'Платіж за підпискою не пройшов',
      subscriptionRenewed: 'Підписку продовжено',
      subscriptionRequired: 'Потрібна підписка',
      subscriptionRestricted: 'Організація перейшла в режим читання',
      taskAssigned: 'Вам призначено завдання',
      taskDue: 'Термін виконання завдання',
      taskReminder: 'Нагадування про завдання',
    },
    bodies: {
      birthdayDigest: (params) =>
        [
          milestoneSection('Дні народження', params.birthdays),
          milestoneSection('Річниці', params.anniversaries),
        ]
          .filter((section): section is string => Boolean(section))
          .join('\n'),
      calendarEventLinked: (params) =>
        `${params.memberName} прив’язано до «${params.eventTitle}», початок ${params.startsAt}.`,
      eventScheduledFor: (params) => `«${params.eventTitle}» заплановано на ${params.startsAt}.`,
      eventStartsAt: (params) => `«${params.eventTitle}» починається ${params.startsAt}.`,
      memberAdded: (params) => `${params.memberName} додано до організації.`,
      memberRemoved: (params) => `${params.memberName} видалено з організації.`,
      membersImported: (params) =>
        `До організації імпортовано учасників: ${String(params.memberCount)}.`,
      prayerRequestCreated: (params) =>
        `${params.authorName} просить молитви: ${params.requestTitle}`,
      subscriptionDeadline: (params) =>
        `Повний доступ діє до ${params.deadline}. Після цього організація перейде в режим читання: наявні дані лишаться доступними, але створювати нове буде не можна.`,
      subscriptionRenewed: (params) => `Платіж пройшов. Наступне списання ${params.nextChargeAt}.`,
      subscriptionRestricted: () =>
        'Організація перейшла в режим читання. Наявні учасники, події, молитовні потреби, сторінки та файли лишаються доступними; створення й редагування відновляться одразу після успішного платежу.',
    },
    platformAdmin: {
      organizationRequestBody: (params) =>
        `Контакт: ${params.contactName}${params.contactEmail ? ` <${params.contactEmail}>` : ''}`,
      organizationRequestTitle: (params) =>
        `Нова заявка на організацію: ${params.organizationName}`,
    },
    unknownMember: 'Учасника',
  },
} as const satisfies Record<AppLocale, NotificationMessageCatalog>;

export function isNotificationTitleKey(value: unknown): value is NotificationTitleKey {
  return (
    typeof value === 'string' && (NOTIFICATION_TITLE_KEYS as readonly string[]).includes(value)
  );
}

export function parseNotificationBodyMessage(value: unknown): NotificationBodyMessage | null {
  const parsed = notificationBodyMessageSchema.safeParse(value);

  return parsed.success ? parsed.data : null;
}

export function renderNotificationTitle(key: NotificationTitleKey, locale: AppLocale): string {
  return NOTIFICATION_MESSAGE_CATALOG[locale].titles[key];
}

export function renderNotificationBody(
  message: NotificationBodyMessage,
  locale: AppLocale,
): string {
  const catalog = NOTIFICATION_MESSAGE_CATALOG[locale];

  switch (message.key) {
    case 'birthdayDigest':
      return catalog.bodies.birthdayDigest({
        birthdays: message.birthdays,
        anniversaries: message.anniversaries,
      });
    case 'calendarEventLinked':
      return catalog.bodies.calendarEventLinked({
        ...eventTimeTexts(message, locale),
        memberName: message.memberName ?? catalog.unknownMember,
      });
    case 'eventScheduledFor':
      return catalog.bodies.eventScheduledFor(eventTimeTexts(message, locale));
    case 'eventStartsAt':
      return catalog.bodies.eventStartsAt(eventTimeTexts(message, locale));
    case 'memberAdded':
      return catalog.bodies.memberAdded({
        memberName: message.memberName ?? catalog.unknownMember,
      });
    case 'memberRemoved':
      return catalog.bodies.memberRemoved({
        memberName: message.memberName ?? catalog.unknownMember,
      });
    case 'membersImported':
      return catalog.bodies.membersImported({ memberCount: message.memberCount });
    case 'prayerRequestCreated':
      return catalog.bodies.prayerRequestCreated({
        authorName: message.authorName ?? catalog.unknownMember,
        requestTitle: message.requestTitle,
      });
    case 'subscriptionDeadline':
      return catalog.bodies.subscriptionDeadline({
        deadline: formatDateTime(new Date(message.deadline), {
          intlLocale: catalog.intlLocale,
          timeZone: message.timeZone,
        }),
      });
    case 'subscriptionRenewed':
      return catalog.bodies.subscriptionRenewed({
        nextChargeAt: formatDateTime(new Date(message.nextChargeAt), {
          intlLocale: catalog.intlLocale,
          timeZone: message.timeZone,
        }),
      });
    case 'subscriptionRestricted':
      return catalog.bodies.subscriptionRestricted();
  }
}

export function renderPlatformAdminOrganizationRequestTitle(
  params: { organizationName: string },
  locale: AppLocale,
): string {
  return NOTIFICATION_MESSAGE_CATALOG[locale].platformAdmin.organizationRequestTitle(params);
}

export function renderPlatformAdminOrganizationRequestBody(
  params: { contactName: string; contactEmail: string | null },
  locale: AppLocale,
): string {
  return NOTIFICATION_MESSAGE_CATALOG[locale].platformAdmin.organizationRequestBody(params);
}

function eventTimeTexts(
  message: { eventTitle: string; startsAt: string; timeZone: string },
  locale: AppLocale,
): EventTimeTexts {
  return {
    eventTitle: message.eventTitle,
    startsAt: formatDateTime(new Date(message.startsAt), {
      intlLocale: NOTIFICATION_MESSAGE_CATALOG[locale].intlLocale,
      timeZone: message.timeZone,
    }),
  };
}

function milestoneSection(label: string, names: string[]): string | null {
  if (names.length === 0) return null;

  return `${label}: ${names.join(', ')}`;
}
