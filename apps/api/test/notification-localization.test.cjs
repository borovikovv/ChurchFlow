const assert = require('node:assert/strict');
const test = require('node:test');
const { APP_LOCALES } = require('@churchflow/shared');
const {
  NOTIFICATION_TITLE_KEYS,
  notificationBodyMessageSchema,
  parseNotificationBodyMessage,
  renderNotificationBody,
  renderNotificationTitle,
} = require('../dist/modules/notifications/notification-messages');
const { NotificationsService } = require('../dist/modules/notifications/notifications.service');
const { EmailService } = require('../dist/modules/email/email.service');
const { InvitationsService } = require('../dist/modules/invitations/invitations.service');

const BODY_SAMPLES = [
  {
    key: 'eventStartsAt',
    eventTitle: 'Sunday service',
    startsAt: '2026-09-01T10:00:00.000Z',
    timeZone: 'Europe/Kyiv',
  },
  {
    key: 'eventScheduledFor',
    eventTitle: 'Sunday service',
    startsAt: '2026-09-01T10:00:00.000Z',
    timeZone: 'Europe/Kyiv',
  },
  {
    key: 'calendarEventLinked',
    memberName: 'Maria',
    eventTitle: 'Sunday service',
    startsAt: '2026-09-01T10:00:00.000Z',
    timeZone: 'Europe/Kyiv',
  },
  { key: 'memberAdded', memberName: 'Maria' },
  { key: 'memberRemoved', memberName: 'Maria' },
  { key: 'membersImported', memberCount: 12 },
  { key: 'prayerRequestCreated', authorName: 'Maria', requestTitle: 'Healing' },
  { key: 'birthdayDigest', birthdays: ['Maria'], anniversaries: ['Ivan'] },
];

test('every notification title is translated into every supported locale', () => {
  for (const key of NOTIFICATION_TITLE_KEYS) {
    const rendered = APP_LOCALES.map((locale) => renderNotificationTitle(key, locale));
    for (const title of rendered) {
      assert.ok(title && title.trim().length > 0, `${key} is missing a title`);
    }
    assert.equal(new Set(rendered).size, rendered.length, `${key} is not translated per locale`);
  }
});

test('body samples cover every notification body message', () => {
  const schemaKeys = notificationBodyMessageSchema.options.map((option) => option.shape.key.value);
  assert.deepEqual([...schemaKeys].sort(), BODY_SAMPLES.map((sample) => sample.key).sort());
});

test('every notification body is translated into every supported locale', () => {
  for (const sample of BODY_SAMPLES) {
    const rendered = APP_LOCALES.map((locale) => renderNotificationBody(sample, locale));
    for (const body of rendered) {
      assert.ok(body && body.trim().length > 0, `${sample.key} is missing a body`);
    }
    assert.equal(new Set(rendered).size, rendered.length, `${sample.key} is not translated`);
  }
});

test('notification dates are formatted in the recipient locale', () => {
  const message = {
    key: 'eventStartsAt',
    eventTitle: 'Sunday service',
    startsAt: '2026-09-01T10:00:00.000Z',
    timeZone: 'Europe/Kyiv',
  };

  assert.match(renderNotificationBody(message, 'en'), /Sep 1, 2026/);
  assert.match(renderNotificationBody(message, 'uk'), /1 вер\. 2026/);
});

test('an unknown stored body message falls back instead of throwing', () => {
  assert.equal(parseNotificationBodyMessage(null), null);
  assert.equal(parseNotificationBodyMessage({ key: 'removedInAnotherRelease' }), null);
  assert.equal(parseNotificationBodyMessage({ key: 'memberAdded' }), null);
});

function createNotificationsService({ emailSends, telegramSends, deliveryRecipients, targets }) {
  return new NotificationsService(
    {
      createNotificationsForMemberships: async () => ({
        createdCount: deliveryRecipients.length,
        deliveryRecipients,
        notificationByRecipientUserId: new Map(),
        notifiedMembershipIds: [],
      }),
      findOrganizationName: async () => ({ name: 'Grace Church' }),
    },
    {
      getNotificationTelegramDeliveries: async () => targets,
    },
    {
      deliverNotification: async (delivery) => {
        telegramSends.push(delivery);
      },
    },
    {
      sendNotificationEmail: async (input) => {
        emailSends.push(input);
      },
    },
  );
}

const PRAYER_REQUEST_INPUT = {
  organizationId: 'organization',
  actorUserId: 'actor',
  recipientMembershipIds: ['membership-admin'],
  type: 'PRAYER_REQUEST_CREATED',
  preferenceKey: 'organizationUpdatesEnabled',
  titleKey: 'prayerRequestCreated',
  bodyMessage: { key: 'prayerRequestCreated', authorName: 'Maria', requestTitle: 'Healing' },
  url: '/dashboard/organization/prayer-requests',
};

test('notification emails are rendered in each recipient locale', async () => {
  const emailSends = [];
  const service = createNotificationsService({
    emailSends,
    telegramSends: [],
    targets: [],
    deliveryRecipients: [
      {
        userId: 'user-en',
        email: 'en@example.com',
        emailEnabled: true,
        telegramEnabled: false,
        locale: 'en',
        notificationId: 'notification-en',
      },
      {
        userId: 'user-uk',
        email: 'uk@example.com',
        emailEnabled: true,
        telegramEnabled: false,
        locale: 'uk',
        notificationId: 'notification-uk',
      },
    ],
  });

  await service.createPrayerRequestCreatedNotifications(PRAYER_REQUEST_INPUT);

  assert.deepEqual(
    emailSends.map((send) => [send.locale, send.title]),
    [
      ['en', 'New prayer request'],
      ['uk', 'Нова молитовна потреба'],
    ],
  );
  assert.match(emailSends[1].body, /просить молитви/);
});

test('telegram notifications are rendered in each recipient locale', async () => {
  const telegramSends = [];
  const service = createNotificationsService({
    emailSends: [],
    telegramSends,
    deliveryRecipients: [
      {
        userId: 'user-uk',
        email: null,
        emailEnabled: false,
        telegramEnabled: true,
        locale: 'uk',
        notificationId: 'notification-uk',
      },
    ],
    targets: [
      {
        notificationId: 'notification-en',
        organizationName: 'Grace Church',
        recipientUserId: 'user-en',
        chatId: 'chat-en',
        locale: 'en',
        url: '/dashboard/organization/prayer-requests',
      },
      {
        notificationId: 'notification-uk',
        organizationName: 'Grace Church',
        recipientUserId: 'user-uk',
        chatId: 'chat-uk',
        locale: 'uk',
        url: '/dashboard/organization/prayer-requests',
      },
    ],
  });

  await service.createPrayerRequestCreatedNotifications(PRAYER_REQUEST_INPUT);

  assert.deepEqual(
    telegramSends.map((delivery) => [delivery.chatId, delivery.title]),
    [
      ['chat-en', 'New prayer request'],
      ['chat-uk', 'Нова молитовна потреба'],
    ],
  );
});

function createListService(items) {
  return new NotificationsService(
    {
      findActiveMembership: async () => ({ id: 'membership', user: { locale: 'uk' } }),
      listForUser: async () => ({ items, nextCursor: null, unreadCount: items.length }),
    },
    {},
    {},
    {},
  );
}

test('stored notifications are rendered in the reader locale and fall back to legacy text', async () => {
  const service = createListService([
    {
      id: 'notification-new',
      organizationId: 'organization',
      type: 'PRAYER_REQUEST_CREATED',
      title: 'New prayer request',
      titleKey: 'prayerRequestCreated',
      body: 'Maria asked for prayer: Healing',
      bodyMessage: { key: 'prayerRequestCreated', authorName: 'Maria', requestTitle: 'Healing' },
      url: null,
      entityType: null,
      entityId: null,
      readAt: null,
      createdAt: new Date('2026-09-01T10:00:00.000Z'),
    },
    {
      id: 'notification-legacy',
      organizationId: 'organization',
      type: 'MEMBER_ADDED',
      title: 'Member added',
      titleKey: null,
      body: 'Maria was added to the organization.',
      bodyMessage: null,
      url: null,
      entityType: null,
      entityId: null,
      readAt: null,
      createdAt: new Date('2026-09-01T10:00:00.000Z'),
    },
  ]);

  const page = await service.listForOrganization('organization', 'reader', {});

  assert.deepEqual(
    page.items.map((item) => [item.title, item.body]),
    [
      ['Нова молитовна потреба', 'Maria просить молитви: Healing'],
      ['Member added', 'Maria was added to the organization.'],
    ],
  );
});

function createEmailService(sends) {
  return new EmailService(
    {
      getOrThrow: (key) => {
        if (key === 'WEB_APP_URL') return 'https://churchflow.test';
        if (key === 'PLATFORM_ADMIN_EMAIL') return 'admin@example.com';
        throw new Error(`Unexpected email config key: ${key}`);
      },
    },
    {
      send: async (message) => {
        sends.push(message);
      },
    },
  );
}

test('invitation emails follow the requested locale and default to English', async () => {
  const sends = [];
  const service = createEmailService(sends);
  const invitation = {
    email: 'invitee@example.com',
    organizationName: 'Grace Church',
    role: 'MEMBER',
    token: 'raw-token',
    expiresAt: new Date('2026-09-01T10:00:00.000Z'),
  };

  await service.sendOrganizationInvitationEmail({ ...invitation, locale: 'uk' });
  await service.sendOrganizationInvitationEmail(invitation);

  assert.equal(sends[0].subject, 'Вас запрошено приєднатися до Grace Church');
  assert.match(sends[0].text, /Прийняти запрошення/);
  assert.equal(sends[1].subject, 'You are invited to join Grace Church');
  assert.match(sends[1].text, /Accept invitation/);
});

function createRecipientLocaleService(localeByEmail) {
  const calls = [];

  return {
    calls,
    service: {
      forUser: async () => 'en',
      forEmail: async (email) => localeByEmail[email] ?? null,
      forRecipient: async (email, fallbackUserId) => {
        calls.push({ email, fallbackUserId });
        return localeByEmail[email] ?? 'en';
      },
    },
  };
}

test('an invitation is written in the invitee locale, not the inviter one', async () => {
  const { calls, service: localeService } = createRecipientLocaleService({
    'invitee@example.com': 'uk',
  });
  let sent;
  const invitations = new InvitationsService(
    {
      findActiveOrganization: async () => ({ id: 'organization', name: 'Grace Church' }),
      findActiveMembership: async () => ({ role: 'OWNER' }),
      createOrRefreshPending: async (input) => ({ id: 'invitation', ...input }),
    },
    {
      buildOrganizationInvitationUrl: (token) => `https://churchflow.test/invitations/${token}`,
      sendOrganizationInvitationEmail: async (input) => {
        sent = input;
      },
    },
    { record: async () => undefined },
    localeService,
  );

  await invitations.createForOrganization(
    '5d39df8a-3180-4311-bc25-4d858f6d663b',
    { mode: 'email', role: 'MEMBER', email: 'invitee@example.com' },
    'b919dd9a-12d5-4460-b0e2-f22f85ca507b',
  );

  assert.deepEqual(calls, [
    { email: 'invitee@example.com', fallbackUserId: 'b919dd9a-12d5-4460-b0e2-f22f85ca507b' },
  ]);
  assert.equal(sent.locale, 'uk');
});

test('an invitee without an account falls back to the inviter locale', async () => {
  const { service: localeService } = createRecipientLocaleService({});
  let sent;
  const invitations = new InvitationsService(
    {
      findActiveOrganization: async () => ({ id: 'organization', name: 'Grace Church' }),
      findActiveMembership: async () => ({ role: 'OWNER' }),
      createOrRefreshPending: async (input) => ({ id: 'invitation', ...input }),
    },
    {
      buildOrganizationInvitationUrl: (token) => `https://churchflow.test/invitations/${token}`,
      sendOrganizationInvitationEmail: async (input) => {
        sent = input;
      },
    },
    { record: async () => undefined },
    localeService,
  );

  await invitations.createForOrganization(
    '5d39df8a-3180-4311-bc25-4d858f6d663b',
    { mode: 'email', role: 'MEMBER', email: 'stranger@example.com' },
    'b919dd9a-12d5-4460-b0e2-f22f85ca507b',
  );

  assert.equal(sent.locale, 'en');
});
