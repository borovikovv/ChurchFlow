const assert = require('node:assert/strict');
const test = require('node:test');
const { TelegramBotService } = require('../dist/modules/telegram-bot/telegram-bot.service');

const SECRET = 'webhook-secret';
const ORGANIZATION = { id: 'org-1', name: 'Grace Church' };

function service({ locale = 'uk', services = [], events = [] } = {}) {
  const repository = {
    findBindingByTelegramIdentity: async () => ({
      userId: 'user-1',
      username: 'tester',
      user: { locale, notificationPreferences: [] },
    }),
    listActiveOrganizationsForUser: async () => [
      { organizationId: ORGANIZATION.id, organizationName: ORGANIZATION.name, role: 'MEMBER' },
    ],
    listUpcomingServicesForOrganization: async () => services,
    listUpcomingServicesForUser: async () => services,
    listUpcomingEventsForUser: async () => events,
  };
  const config = {
    get: (key) => ({ TELEGRAM_WEBHOOK_SECRET: SECRET, TELEGRAM_BOT_TOKEN: 'token' })[key],
  };

  return new TelegramBotService(config, repository);
}

function serviceRecord(overrides = {}) {
  return {
    id: 'event-1',
    organizationId: ORGANIZATION.id,
    organization: ORGANIZATION,
    type: 'SERVICE',
    title: 'Sunday service',
    description: '<p>Come <strong>early</strong></p><ul><li><p>Bring Bibles</p></li></ul>',
    startsAt: new Date('2026-09-20T07:00:00.000Z'),
    endsAt: null,
    allDay: false,
    repeatPeriod: 'NONE',
    taskCompleted: false,
    serviceDetails: {
      biblePassage: 'John 3:16',
      participants: [
        { role: 'PREACHER', displayNameSnapshot: 'Ivan', customName: null },
        { role: 'WORSHIP_LEAD', displayNameSnapshot: null, customName: 'Guest band' },
      ],
      songs: [
        { order: 1, title: 'Amazing Grace' },
        { order: 2, title: 'How Great Thou Art' },
      ],
    },
    ...overrides,
  };
}

async function sentMessages(bot, text) {
  const calls = [];
  const originalFetch = global.fetch;
  global.fetch = async (_url, init) => {
    calls.push(JSON.parse(init.body));
    return { ok: true, json: async () => ({ ok: true }) };
  };
  try {
    await bot.handleWebhook(SECRET, {
      message: { chat: { id: 42 }, from: { id: 7 }, text },
    });
  } finally {
    global.fetch = originalFetch;
  }

  return calls;
}

test('/next renders the full service block with songs and rich text description', async () => {
  const [message] = await sentMessages(service({ services: [serviceRecord()] }), '/next');

  assert.equal(message.parse_mode, 'HTML');
  assert.equal(
    message.text,
    [
      '⛪ <b>Наступне служіння</b>',
      'Grace Church',
      '',
      '<b>Нд, 20 вересня · 10:00</b>',
      '',
      'Sunday service',
      '',
      '<b>Уривок:</b> John 3:16',
      '',
      '<b>Проповідник:</b> Ivan',
      '<b>Прославлення:</b> Guest band',
      '',
      '<b>Пісні:</b>',
      '1. Amazing Grace',
      '2. How Great Thou Art',
      '',
      '<b>Опис:</b>',
      'Come <b>early</b>',
      '',
      '• Bring Bibles',
    ].join('\n'),
  );
});

test('/next splits long services across messages without cutting the description', async () => {
  const paragraphs = Array.from(
    { length: 12 },
    (_, index) => `<p>${String(index + 1).padStart(3, '0')} ${'слово '.repeat(120).trim()}</p>`,
  );
  const songs = Array.from({ length: 12 }, (_, index) => ({
    order: index + 1,
    title: `Пісня ${String(index + 1)} ${'ля '.repeat(50).trim()}`,
  }));
  const record = serviceRecord({
    description: paragraphs.join(''),
    serviceDetails: { ...serviceRecord().serviceDetails, songs },
  });

  const messages = await sentMessages(service({ services: [record] }), '/next');

  assert.ok(messages.length > 1, 'expected more than one message');
  for (const message of messages) {
    assert.ok(message.text.length <= 4096, `message too long: ${String(message.text.length)}`);
    assert.equal(message.parse_mode, 'HTML');
  }
  const combined = messages.map((message) => message.text).join('\n\n');
  assert.match(combined, /^⛪ <b>Наступне служіння<\/b>/);
  assert.match(combined, /<b>Пісні:<\/b>\n1\. Пісня 1/);
  assert.match(combined, /12\. Пісня 12/);
  assert.match(combined, /<b>Опис:<\/b>\n001 слово/);
  assert.match(combined, /012 слово(?: слово)*$/);
  assert.doesNotMatch(combined, /…/);
});

test('/next reports when nothing is scheduled', async () => {
  const [message] = await sentMessages(service({ locale: 'en' }), '/next');

  assert.equal(message.text, 'No upcoming services were found.');
});

test('menu buttons route to the same handlers as commands', async () => {
  const bot = service({ locale: 'en', services: [serviceRecord()] });
  const [fromCommand] = await sentMessages(bot, '/mysermons');
  const [fromButton] = await sentMessages(bot, '🎤 My sermons');

  assert.equal(fromCommand.text, fromButton.text);
  assert.match(fromCommand.text, /^🎤 <b>My sermons<\/b>\nGrace Church\n\n<b>SEPTEMBER 2026<\/b>/);
  assert.doesNotMatch(fromCommand.text, /Songs|Description/);
});

test('/myevents lists non-service events with type label and description', async () => {
  const [message] = await sentMessages(
    service({
      locale: 'en',
      events: [
        serviceRecord({
          type: 'TASK',
          title: 'Prepare slides',
          taskCompleted: true,
          description: 'Plain <legacy> text',
          serviceDetails: null,
        }),
      ],
    }),
    '/myevents',
  );

  assert.equal(
    message.text,
    [
      '🗓 <b>My events</b>',
      'Grace Church',
      '',
      '<b>SEPTEMBER 2026</b>',
      '',
      '<b>Sun, September 20 · 10:00</b>',
      '',
      '✅ Prepare slides',
      '',
      '<i>Task</i>',
      '',
      '<b>Description:</b>',
      'Plain  text',
    ].join('\n'),
  );
});

test('/help lists the new actions and the menu carries all five buttons', async () => {
  const [message] = await sentMessages(service({ locale: 'en' }), '/help');

  assert.match(message.text, /⛪ Next service or \/next - Next service/);
  assert.match(message.text, /🎤 My sermons or \/mysermons - My sermons/);
  assert.match(message.text, /🗓 My events or \/myevents - My events/);
  assert.deepEqual(
    message.reply_markup.keyboard.map((row) => row.map((button) => button.text)),
    [['⛪ Next service', '📅 Service Schedule'], ['🎤 My sermons', '🗓 My events'], ['🙏 Prayers']],
  );
});
