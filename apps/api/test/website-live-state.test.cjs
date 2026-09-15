const assert = require('node:assert/strict');
const test = require('node:test');
const { websiteSettingsSchema } = require('@churchflow/shared');
const { computeLiveState } = require('../dist/modules/websites/live-state.js');

function settings(overrides = {}) {
  return websiteSettingsSchema.parse({
    timeZone: 'Europe/Kyiv',
    serviceTimes: [
      { weekday: 0, time: '10:00', durationMinutes: 90, label: 'Sunday service' },
      { weekday: 3, time: '19:00', durationMinutes: 60 },
    ],
    live: { mode: 'schedule', leadMinutes: 5 },
    ...overrides,
  });
}

const kyiv = (iso) => new Date(`${iso}+03:00`);

test('schedule mode is live from lead time before the service until it ends', () => {
  assert.equal(computeLiveState(settings(), kyiv('2026-09-20T09:54:00')).isLive, false);
  assert.equal(computeLiveState(settings(), kyiv('2026-09-20T09:56:00')).isLive, true);
  assert.equal(computeLiveState(settings(), kyiv('2026-09-20T11:29:00')).isLive, true);
  assert.equal(computeLiveState(settings(), kyiv('2026-09-20T11:31:00')).isLive, false);
});

test('schedule mode reads local time in the website time zone, not UTC', () => {
  assert.equal(computeLiveState(settings(), new Date('2026-09-20T07:30:00Z')).isLive, true);
  assert.equal(
    computeLiveState(settings({ timeZone: 'UTC' }), new Date('2026-09-20T07:30:00Z')).isLive,
    false,
  );
});

test('manual mode ignores the schedule and follows the switch', () => {
  const live = settings({ live: { mode: 'manual', isLive: true } });
  const off = settings({ live: { mode: 'manual', isLive: false } });

  assert.equal(computeLiveState(live, kyiv('2026-09-21T03:00:00')).isLive, true);
  assert.equal(computeLiveState(off, kyiv('2026-09-20T10:30:00')).isLive, false);
});

test('the next service is the closest upcoming slot in the week, wrapping past Saturday', () => {
  const monday = computeLiveState(settings(), kyiv('2026-09-21T12:00:00'));
  assert.equal(monday.nextService.weekday, 3);
  assert.equal(monday.nextService.startsAt, kyiv('2026-09-23T19:00:00').toISOString());

  const thursday = computeLiveState(settings(), kyiv('2026-09-24T12:00:00'));
  assert.equal(thursday.nextService.weekday, 0);
  assert.equal(thursday.nextService.label, 'Sunday service');
  assert.equal(thursday.nextService.startsAt, kyiv('2026-09-27T10:00:00').toISOString());
});

test('no service times means nothing is live and there is no next service', () => {
  const state = computeLiveState(settings({ serviceTimes: [] }), kyiv('2026-09-20T10:30:00'));
  assert.equal(state.isLive, false);
  assert.equal(state.nextService, null);
});
