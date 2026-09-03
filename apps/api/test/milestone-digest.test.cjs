const assert = require('node:assert/strict');
const test = require('node:test');

const {
  CalendarEventsService,
} = require('../dist/modules/calendar-events/calendar-events.service.js');

// 2020-08-31T00:00 in Europe/Kyiv, the shape the calendar form stores for an all-day event.
const MILESTONE_STARTS_AT = new Date('2020-08-30T21:00:00.000Z');
// 09:00 in Europe/Kyiv on 2026-08-31.
const DIGEST_RUN_AT = new Date('2026-08-31T06:00:00.000Z');

function milestoneEvent({
  id,
  type,
  title,
  displayName = null,
  status = 'ACTIVE',
  removedAt = null,
  repeatPeriod = 'YEARLY',
}) {
  return {
    id,
    organizationId: 'organization',
    createdByUserId: null,
    linkedMembershipId: displayName === null ? null : `${id}-membership`,
    linkedMembership:
      displayName === null ? null : { status, removedAt, profile: { displayName }, user: null },
    type,
    title,
    startsAt: MILESTONE_STARTS_AT,
    endsAt: null,
    allDay: true,
    reminder: null,
    repeatPeriod,
    assignees: [],
    serviceDetails: null,
  };
}

// Mirrors the `listReminderCandidates` query: only repeating or reminded events survive once
// their start is older than the reminder window.
function reminderCandidates(events, windowEnd) {
  return events.filter(
    (event) =>
      event.startsAt < windowEnd &&
      (event.repeatPeriod !== 'NONE' ||
        event.reminder !== null ||
        event.startsAt >= new Date(windowEnd.getTime() - 5 * 60 * 1000)),
  );
}

// Mirrors the `listMilestoneDigestCandidates` query.
function digestCandidates(events, rangeStart, rangeEnd) {
  return events.filter(
    (event) =>
      (event.type === 'BIRTHDAY' || event.type === 'ANNIVERSARY') &&
      event.startsAt < rangeEnd &&
      (event.repeatPeriod !== 'NONE' || event.startsAt >= rangeStart),
  );
}

function createService(events) {
  const created = [];
  const repository = {
    listReminderCandidates: async (_windowStart, windowEnd) =>
      reminderCandidates(events, windowEnd),
    listMilestoneDigestCandidates: async (rangeStart, rangeEnd) =>
      digestCandidates(events, rangeStart, rangeEnd),
    findCreatorMembershipId: async () => null,
    listAdminNotificationRecipientMembershipIds: async () => [],
    listCalendarEventNotificationRecipientMembershipIds: async () => ['member-a', 'member-b'],
    listReminderRecipientMemberships: async (_organizationId, membershipIds) =>
      membershipIds.map((id) => ({ id, timeZone: 'Europe/Kyiv' })),
  };
  const notificationsService = {
    createCalendarReminderNotifications: async (input) => {
      created.push(input);
      return {
        createdCount: input.recipientMembershipIds.length,
        emailSentCount: 0,
        telegramSentCount: 0,
      };
    },
  };

  return { service: new CalendarEventsService(repository, notificationsService), created };
}

test('birthdays and anniversaries on the same day arrive as one grouped notification', async () => {
  const { service, created } = createService([
    milestoneEvent({
      id: 'birthday-maria',
      type: 'BIRTHDAY',
      title: 'День народження: Maria',
      displayName: 'Maria',
    }),
    milestoneEvent({
      id: 'birthday-ivan',
      type: 'BIRTHDAY',
      title: 'День народження: Ivan',
      displayName: 'Ivan',
    }),
    milestoneEvent({
      id: 'anniversary-petro',
      type: 'ANNIVERSARY',
      title: 'Річниця: Petro',
      displayName: 'Petro',
    }),
  ]);

  await service.createDueReminderNotifications(DIGEST_RUN_AT);

  assert.equal(created.length, 1);
  const [digest] = created;
  assert.equal(digest.type, 'BIRTHDAY_DIGEST');
  assert.equal(digest.preferenceKey, 'birthdayDigestEnabled');
  assert.equal(digest.titleKey, 'birthdayDigestBirthdaysAndAnniversaries');
  assert.deepEqual(digest.bodyMessage.birthdays, ['Ivan', 'Maria']);
  assert.deepEqual(digest.bodyMessage.anniversaries, ['Petro']);
  assert.deepEqual(digest.recipientMembershipIds, ['member-a', 'member-b']);
  assert.match(digest.dedupeKey, /^birthday-digest:2026-08-31:Europe\/Kyiv:[0-9a-f]{12}$/);
});

test('a digest still goes out when the notification hour run was missed', async () => {
  const { service, created } = createService([
    milestoneEvent({
      id: 'birthday-maria',
      type: 'BIRTHDAY',
      title: 'День народження: Maria',
      displayName: 'Maria',
    }),
    milestoneEvent({
      id: 'anniversary-petro',
      type: 'ANNIVERSARY',
      title: 'Річниця: Petro',
      displayName: 'Petro',
    }),
  ]);

  // 14:00 in Europe/Kyiv, hours after the notification hour.
  await service.createDueReminderNotifications(new Date('2026-08-31T11:00:00.000Z'));

  assert.equal(created.length, 1);
  assert.deepEqual(created[0].bodyMessage.birthdays, ['Maria']);
  assert.deepEqual(created[0].bodyMessage.anniversaries, ['Petro']);
});

test('repeated runs over the same milestones keep one dedupe key', async () => {
  const events = [
    milestoneEvent({
      id: 'birthday-maria',
      type: 'BIRTHDAY',
      title: 'День народження: Maria',
      displayName: 'Maria',
    }),
  ];
  const first = createService(events);
  const second = createService(events);

  await first.service.createDueReminderNotifications(DIGEST_RUN_AT);
  await second.service.createDueReminderNotifications(new Date('2026-08-31T06:05:00.000Z'));

  assert.equal(first.created[0].dedupeKey, second.created[0].dedupeKey);
});

test('a milestone added later in the day is announced by a new digest', async () => {
  const maria = milestoneEvent({
    id: 'birthday-maria',
    type: 'BIRTHDAY',
    title: 'День народження: Maria',
    displayName: 'Maria',
  });
  const ivan = milestoneEvent({
    id: 'birthday-ivan',
    type: 'BIRTHDAY',
    title: 'День народження: Ivan',
    displayName: 'Ivan',
  });
  const morning = createService([maria]);
  const afternoon = createService([maria, ivan]);

  await morning.service.createDueReminderNotifications(DIGEST_RUN_AT);
  await afternoon.service.createDueReminderNotifications(new Date('2026-08-31T11:00:00.000Z'));

  assert.deepEqual(afternoon.created[0].bodyMessage.birthdays, ['Ivan', 'Maria']);
  assert.notEqual(morning.created[0].dedupeKey, afternoon.created[0].dedupeKey);
});

test('a milestone digest is only sent at the all-day notification hour', async () => {
  const { service, created } = createService([
    milestoneEvent({
      id: 'birthday-maria',
      type: 'BIRTHDAY',
      title: 'День народження: Maria',
      displayName: 'Maria',
    }),
  ]);

  // Midnight in Europe/Kyiv on the same day: the occurrence starts, but the digest must not fire.
  await service.createDueReminderNotifications(new Date('2026-08-30T21:00:00.000Z'));

  assert.equal(created.length, 0);
});

test('only birthdays falling today are grouped', async () => {
  const { service, created } = createService([
    milestoneEvent({
      id: 'birthday-maria',
      type: 'BIRTHDAY',
      title: 'День народження: Maria',
      displayName: 'Maria',
    }),
    {
      ...milestoneEvent({
        id: 'birthday-later',
        type: 'BIRTHDAY',
        title: 'День народження: Later',
        displayName: 'Later',
      }),
      startsAt: new Date('2020-09-04T21:00:00.000Z'),
    },
  ]);

  await service.createDueReminderNotifications(DIGEST_RUN_AT);

  assert.equal(created.length, 1);
  assert.equal(created[0].titleKey, 'birthdayDigestBirthdays');
  assert.deepEqual(created[0].bodyMessage.birthdays, ['Maria']);
});

test('milestones of removed or archived members are not announced', async () => {
  const { service, created } = createService([
    milestoneEvent({
      id: 'birthday-maria',
      type: 'BIRTHDAY',
      title: 'День народження: Maria',
      displayName: 'Maria',
    }),
    milestoneEvent({
      id: 'birthday-removed',
      type: 'BIRTHDAY',
      title: 'День народження: Removed',
      displayName: 'Removed',
      status: 'REMOVED',
      removedAt: new Date('2026-01-01T00:00:00.000Z'),
    }),
    milestoneEvent({
      id: 'anniversary-archived',
      type: 'ANNIVERSARY',
      title: 'Річниця: Archived',
      displayName: 'Archived',
      status: 'ARCHIVED',
    }),
  ]);

  await service.createDueReminderNotifications(DIGEST_RUN_AT);

  assert.equal(created.length, 1);
  assert.equal(created[0].titleKey, 'birthdayDigestBirthdays');
  assert.deepEqual(created[0].bodyMessage.birthdays, ['Maria']);
  assert.deepEqual(created[0].bodyMessage.anniversaries, []);
});

test('one-off milestones that started earlier today are still grouped into the digest', async () => {
  const { service, created } = createService([
    {
      ...milestoneEvent({
        id: 'birthday-all-day',
        type: 'BIRTHDAY',
        title: 'Це день народження весь день',
        repeatPeriod: 'NONE',
      }),
      // 2026-08-31T00:00 in Europe/Kyiv: it starts hours before the digest runs.
      startsAt: new Date('2026-08-30T21:00:00.000Z'),
    },
    {
      ...milestoneEvent({
        id: 'anniversary-all-day',
        type: 'ANNIVERSARY',
        title: 'Це річниця',
        repeatPeriod: 'NONE',
      }),
      startsAt: new Date('2026-08-30T21:00:00.000Z'),
    },
    milestoneEvent({
      id: 'birthday-yearly',
      type: 'BIRTHDAY',
      title: 'А це день народження о 10:00',
    }),
  ]);

  await service.createDueReminderNotifications(DIGEST_RUN_AT);

  assert.equal(created.length, 1);
  assert.equal(created[0].titleKey, 'birthdayDigestBirthdaysAndAnniversaries');
  assert.deepEqual(created[0].bodyMessage.birthdays, [
    'А це день народження о 10:00',
    'Це день народження весь день',
  ]);
  assert.deepEqual(created[0].bodyMessage.anniversaries, ['Це річниця']);
});
