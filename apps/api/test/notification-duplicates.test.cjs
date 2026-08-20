const assert = require('node:assert/strict');
const test = require('node:test');
const { CALENDAR_EVENT_REPEAT_PERIOD, CALENDAR_EVENT_TYPE } = require('@churchflow/shared');
const {
  CalendarEventsService,
} = require('../dist/modules/calendar-events/calendar-events.service');
const {
  NotificationsRepository,
} = require('../dist/modules/notifications/repositories/notifications.repository');

const ORGANIZATION_ID = 'organization';
const EVENT_ID = '3f1a1f3e-0000-4000-8000-000000000001';

function taskEvent(overrides = {}) {
  return {
    id: EVENT_ID,
    organizationId: ORGANIZATION_ID,
    type: CALENDAR_EVENT_TYPE.task,
    title: 'Prepare Sunday service',
    description: null,
    startsAt: new Date('2026-09-01T10:00:00.000Z'),
    endsAt: null,
    allDay: false,
    reminder: null,
    repeatPeriod: CALENDAR_EVENT_REPEAT_PERIOD.none,
    taskCompleted: false,
    createdByUserId: 'creator-user',
    linkedMembershipId: 'membership-linked',
    linkedMembership: null,
    assignees: [],
    serviceDetails: null,
    imageAsset: null,
    ...overrides,
  };
}

function createService(event, calls, notifiedMembershipIds) {
  return new CalendarEventsService(
    {
      create: async () => event,
      listAdminNotificationRecipientMembershipIds: async () => [
        'membership-admin',
        'membership-other-admin',
      ],
    },
    {
      createTaskAssignedNotifications: async (input) => {
        calls.push({ kind: 'taskAssigned', membershipIds: input.assigneeMembershipIds });
        return { createdCount: 1, emailSentCount: 1, telegramSentCount: 0, notifiedMembershipIds };
      },
      createServiceAssignedNotifications: async () => {
        throw new Error('service notifications must not run for a task');
      },
      createCalendarLinkedNotifications: async (input) => {
        calls.push({ kind: 'calendarLinked', membershipIds: input.recipientMembershipIds });
        return {
          createdCount: 1,
          emailSentCount: 1,
          telegramSentCount: 0,
          notifiedMembershipIds: input.recipientMembershipIds,
        };
      },
    },
  );
}

test('assignee who is also an admin receives one notification for a created task', async () => {
  const event = taskEvent({ assignees: [{ membershipId: 'membership-admin', membership: null }] });
  const calls = [];

  await createService(event, calls, ['membership-admin']).create(ORGANIZATION_ID, {}, 'actor-user');

  assert.deepEqual(calls, [
    { kind: 'taskAssigned', membershipIds: ['membership-admin'] },
    { kind: 'calendarLinked', membershipIds: ['membership-other-admin'] },
  ]);
});

test('assignee whose task notification was filtered out still receives the linked notice', async () => {
  const event = taskEvent({ assignees: [{ membershipId: 'membership-admin', membership: null }] });
  const calls = [];

  await createService(event, calls, []).create(ORGANIZATION_ID, {}, 'actor-user');

  assert.deepEqual(calls, [
    { kind: 'taskAssigned', membershipIds: ['membership-admin'] },
    { kind: 'calendarLinked', membershipIds: ['membership-admin', 'membership-other-admin'] },
  ]);
});

test('linked recipients still receive the start notification when a reminder is configured', async () => {
  const event = taskEvent({
    reminder: 'ONE_HOUR',
    linkedMembershipId: null,
    assignees: [{ membershipId: 'membership-creator', membership: null }],
  });
  const calls = [];
  const service = new CalendarEventsService(
    {
      listReminderCandidates: async () => [event],
      findCreatorMembershipId: async () => 'membership-creator',
      listAdminNotificationRecipientMembershipIds: async () => ['membership-admin'],
      listCalendarEventNotificationRecipientMembershipIds: async () => [
        'membership-creator',
        'membership-admin',
      ],
      listReminderRecipientMemberships: async (_organizationId, membershipIds) =>
        [...new Set(membershipIds)].map((id) => ({ id, timeZone: 'UTC' })),
    },
    {
      createCalendarReminderNotifications: async (input) => {
        calls.push({ dedupeKey: input.dedupeKey, membershipIds: input.recipientMembershipIds });
        return { createdCount: 1, emailSentCount: 1, telegramSentCount: 0 };
      },
    },
  );

  await service.createDueReminderNotifications(new Date('2026-09-01T10:00:00.000Z'));

  assert.equal(calls.length, 1);
  assert.match(calls[0].dedupeKey, /^calendar-event:/);
  assert.deepEqual(calls[0].membershipIds, ['membership-creator', 'membership-admin']);
});

function preferences(overrides = {}) {
  return {
    inAppEnabled: true,
    emailEnabled: true,
    telegramEnabled: false,
    remindersEnabled: true,
    ...overrides,
  };
}

function prismaStub(memberships, rows) {
  return {
    organizationMember: { findMany: async () => memberships },
    notification: {
      findMany: async ({ where }) =>
        rows.filter(
          (row) =>
            row.organizationId === where.organizationId &&
            where.recipientUserId.in.includes(row.recipientUserId) &&
            row.type === where.type &&
            row.dedupeKey === where.dedupeKey &&
            row.deletedAt === where.deletedAt,
        ),
      createMany: async ({ data }) => {
        const created = data.filter(
          (row) =>
            !rows.some(
              (existing) =>
                existing.organizationId === row.organizationId &&
                existing.recipientUserId === row.recipientUserId &&
                existing.type === row.type &&
                existing.dedupeKey === row.dedupeKey,
            ),
        );
        for (const row of created) {
          rows.push({ id: `notification-${rows.length + 1}`, deletedAt: null, ...row });
        }
        return { count: created.length };
      },
    },
  };
}

const REMINDER_INPUT = {
  organizationId: ORGANIZATION_ID,
  actorUserId: null,
  recipientMembershipIds: ['membership-creator', 'membership-admin'],
  type: 'TASK_DUE_REMINDER',
  preferenceKey: 'remindersEnabled',
  title: 'Task reminder',
  body: null,
  url: '/dashboard/organization/calendar',
  entityType: 'CalendarEvent',
  entityId: EVENT_ID,
  dedupeKey: `calendar-reminder:${EVENT_ID}:3600000:2026-09-01T10:00:00.000Z:UTC`,
};

test('recipient with in-app notifications disabled is not emailed twice for one occurrence', async () => {
  const rows = [];
  const repository = new NotificationsRepository(
    prismaStub(
      [
        {
          id: 'membership-creator',
          userId: 'creator-user',
          user: {
            email: 'creator@example.com',
            deletedAt: null,
            notificationPreferences: [preferences({ inAppEnabled: false })],
          },
        },
      ],
      rows,
    ),
  );

  const first = await repository.createNotificationsForMemberships(REMINDER_INPUT);
  assert.deepEqual(
    first.deliveryRecipients.map((recipient) => recipient.userId),
    ['creator-user'],
  );
  assert.deepEqual(first.notifiedMembershipIds, ['membership-creator']);
  assert.equal(rows.length, 1);
  assert.notEqual(rows[0].archivedAt, null);
  assert.notEqual(rows[0].readAt, null);

  const second = await repository.createNotificationsForMemberships(REMINDER_INPUT);
  assert.deepEqual(second.deliveryRecipients, []);
  assert.deepEqual(second.notifiedMembershipIds, []);
  assert.equal(rows.length, 1);
});

test('mixed batch keeps the inbox row for in-app recipients and hides the tracking row', async () => {
  const rows = [];
  const repository = new NotificationsRepository(
    prismaStub(
      [
        {
          id: 'membership-creator',
          userId: 'creator-user',
          user: {
            email: 'creator@example.com',
            deletedAt: null,
            notificationPreferences: [preferences({ inAppEnabled: false })],
          },
        },
        {
          id: 'membership-admin',
          userId: 'admin-user',
          user: {
            email: 'admin@example.com',
            deletedAt: null,
            notificationPreferences: [preferences()],
          },
        },
      ],
      rows,
    ),
  );

  const result = await repository.createNotificationsForMemberships(REMINDER_INPUT);

  assert.deepEqual(result.deliveryRecipients.map((recipient) => recipient.userId).sort(), [
    'admin-user',
    'creator-user',
  ]);
  assert.deepEqual(result.notifiedMembershipIds.sort(), ['membership-admin', 'membership-creator']);

  const byUser = new Map(
    result.deliveryRecipients.map((recipient) => [recipient.userId, recipient.notificationId]),
  );
  assert.notEqual(byUser.get('admin-user'), null);
  assert.equal(byUser.get('creator-user'), null);

  const rowByUser = new Map(rows.map((row) => [row.recipientUserId, row]));
  assert.equal(rowByUser.get('admin-user').archivedAt, null);
  assert.notEqual(rowByUser.get('creator-user').archivedAt, null);
});
