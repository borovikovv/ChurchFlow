const assert = require('node:assert/strict');
const test = require('node:test');
const { TelegramBotService } = require('../dist/modules/telegram-bot/telegram-bot.service');

// The bot filters events against the real clock, so the fixtures below only stay "upcoming" while
// time is pinned before them.
const NOW = new Date('2026-09-17T12:00:00.000Z');
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

test.beforeEach(() => {
  test.mock.timers.enable({ apis: ['Date'], now: NOW });
});

test.afterEach(() => {
  test.mock.timers.reset();
});

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

test('/myevents merges services and events for the user in date order with separators', async () => {
  const bot = service({
    locale: 'en',
    events: [
      serviceRecord({
        id: 'event-2',
        type: 'TASK',
        title: 'Prepare slides',
        taskCompleted: true,
        description: 'Plain <legacy> text',
        serviceDetails: null,
        startsAt: new Date('2026-09-18T07:00:00.000Z'),
      }),
      serviceRecord(),
    ],
  });
  const [fromCommand] = await sentMessages(bot, '/myevents');
  const [fromButton] = await sentMessages(bot, '✝️ My events');

  assert.equal(fromCommand.text, fromButton.text);
  assert.equal(
    fromCommand.text,
    [
      '✝️ <b>My events</b>',
      'Grace Church',
      '',
      '<b>SEPTEMBER 2026</b>',
      '',
      '<b>Fri, September 18 · 10:00</b>',
      '',
      '✅ Prepare slides',
      '',
      '<i>Task</i>',
      '',
      '<b>Description:</b>',
      'Plain  text',
      '',
      '──────────────',
      '',
      '<b>Sun, September 20 · 10:00</b>',
      '',
      'Sunday service',
      '',
      '<b>Bible passage:</b> John 3:16',
      '',
      '<b>Preacher:</b> Ivan',
      '<b>Worship:</b> Guest band',
    ].join('\n'),
  );
  assert.doesNotMatch(fromCommand.text, /Songs/);
});

test('/help lists the new actions and the menu carries all four buttons', async () => {
  const [message] = await sentMessages(service({ locale: 'en' }), '/help');

  assert.match(message.text, /⛪ Next service or \/next - Next service/);
  assert.doesNotMatch(message.text, /mysermons/);
  assert.match(message.text, /✝️ My events or \/myevents - My events/);
  assert.deepEqual(
    message.reply_markup.keyboard.map((row) => row.map((button) => button.text)),
    [
      ['⛪ Next service', '📅 Service Schedule'],
      ['✝️ My events', '🙏 Prayers'],
    ],
  );
});

test('every action refreshes the persistent menu on its last message only', async () => {
  const paragraphs = Array.from(
    { length: 12 },
    (_, index) => `<p>${String(index + 1)} ${'слово '.repeat(120).trim()}</p>`,
  );
  const bot = service({
    locale: 'en',
    services: [serviceRecord({ description: paragraphs.join('') })],
  });
  const expectedKeyboard = [
    ['⛪ Next service', '📅 Service Schedule'],
    ['✝️ My events', '🙏 Prayers'],
  ];
  const keyboardOf = (message) =>
    message.reply_markup?.keyboard.map((row) => row.map((button) => button.text));

  const chunked = await sentMessages(bot, '/next');
  assert.ok(chunked.length > 1);
  assert.deepEqual(
    chunked.slice(0, -1).map(keyboardOf),
    chunked.slice(0, -1).map(() => undefined),
  );
  assert.deepEqual(keyboardOf(chunked[chunked.length - 1]), expectedKeyboard);

  const [empty] = await sentMessages(service({ locale: 'en' }), '/myevents');
  assert.equal(empty.text, 'You have no services or events this month and next month.');
  assert.deepEqual(keyboardOf(empty), expectedKeyboard);
});
