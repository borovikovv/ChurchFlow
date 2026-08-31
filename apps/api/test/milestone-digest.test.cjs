const assert = require('node:assert/strict');
const test = require('node:test');

const {
  CalendarEventsService,
} = require('../dist/modules/calendar-events/calendar-events.service.js');

// 2020-08-31T00:00 in Europe/Kyiv, the shape the calendar form stores for an all-day event.
const MILESTONE_STARTS_AT = new Date('2020-08-30T21:00:00.000Z');
// 09:00 in Europe/Kyiv on 2026-08-31.
const DIGEST_RUN_AT = new Date('2026-08-31T06:00:00.000Z');

function milestoneEvent({ id, type, title, displayName }) {
  return {
    id,
    organizationId: 'organization',
    createdByUserId: null,
    linkedMembershipId: `${id}-membership`,
    linkedMembership: { profile: { displayName }, user: null },
    type,
    title,
    startsAt: MILESTONE_STARTS_AT,
    endsAt: null,
    allDay: true,
    reminder: null,
    repeatPeriod: 'YEARLY',
    assignees: [],
    serviceDetails: null,
  };
}

function createService(events) {
  const created = [];
  const repository = {
    listReminderCandidates: async () => events,
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
  assert.equal(digest.dedupeKey, 'birthday-digest:2026-08-31:Europe/Kyiv');
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
