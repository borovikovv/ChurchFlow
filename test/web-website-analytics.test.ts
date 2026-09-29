import assert from 'node:assert/strict';
import test from 'node:test';
import {
  analyticsBootstrapScript,
  analyticsConsentStorageKey,
  parseAnalyticsConsent,
  publicMeasurementId,
} from '../apps/web/app/(public)/o/_lib/website-analytics-consent.ts';
import { readAnalyticsConnectFeedback } from '../apps/web/app/(dashboard)/dashboard/[orgId]/website/analytics/analytics-connect-feedback.ts';
import {
  flattenAnalyticsProperties,
  formatTrendDay,
  toRankedBars,
} from '../apps/web/app/(dashboard)/dashboard/[orgId]/website/analytics/analytics-report-view.ts';

test('only a well-formed GA4 measurement id reaches the public page', () => {
  assert.equal(publicMeasurementId('G-ABC1234'), 'G-ABC1234');
  assert.equal(publicMeasurementId(' g-abc1234 '), 'G-ABC1234');
  assert.equal(publicMeasurementId('UA-12345-1'), null);
  assert.equal(publicMeasurementId('G-ABC1234"</script><script>alert(1)'), null);
  assert.equal(publicMeasurementId(''), null);
  assert.equal(publicMeasurementId(null), null);
  assert.equal(publicMeasurementId(undefined), null);
});

test('the bootstrap script denies analytics storage until the stored answer grants it', () => {
  const script = analyticsBootstrapScript({ measurementId: 'G-ABC1234', orgSlug: 'grace' });

  assert.match(script, /var consent="denied";/);
  assert.match(script, /localStorage\.getItem\("churchflow:analytics-consent:grace"\)/);
  assert.match(script, /ad_storage:"denied"/);
  assert.match(script, /analytics_storage:consent/);
  assert.ok(
    script.indexOf('gtag("consent","default"') < script.indexOf('gtag("config","G-ABC1234")'),
    'consent defaults must be queued before the config command',
  );
});

test('a slug cannot break out of the bootstrap script', () => {
  const script = analyticsBootstrapScript({ measurementId: 'G-ABC1234', orgSlug: '</script>"x' });

  assert.equal(script.includes('</script>'), false);
  assert.ok(script.includes('\\u003c/script>\\"x'));
});

test('consent is remembered per church site and only as an explicit answer', () => {
  assert.notEqual(analyticsConsentStorageKey('grace'), analyticsConsentStorageKey('hope'));
  assert.equal(parseAnalyticsConsent('granted'), 'granted');
  assert.equal(parseAnalyticsConsent('denied'), 'denied');
  assert.equal(parseAnalyticsConsent('yes'), null);
  assert.equal(parseAnalyticsConsent(true), null);
  assert.equal(parseAnalyticsConsent(null), null);
});

test('the connect outcome is read from the query the API redirected with', () => {
  assert.deepEqual(readAnalyticsConnectFeedback({ ga: 'connected' }), { result: 'connected' });
  assert.deepEqual(readAnalyticsConnectFeedback({ ga: 'error', gaReason: 'scope' }), {
    result: 'error',
    reason: 'scope',
  });
  assert.deepEqual(readAnalyticsConnectFeedback({ ga: 'error', gaReason: 'something-new' }), {
    result: 'error',
    reason: 'exchange',
  });
  assert.deepEqual(readAnalyticsConnectFeedback({ ga: 'error' }), {
    result: 'error',
    reason: 'exchange',
  });
  assert.equal(readAnalyticsConnectFeedback({}), null);
  assert.equal(readAnalyticsConnectFeedback({ ga: ['connected', 'error'] }), null);
});

test('properties are listed with their account so same-named ones stay apart', () => {
  assert.deepEqual(
    flattenAnalyticsProperties({
      accounts: [
        {
          id: '1',
          displayName: 'Grace',
          properties: [
            { id: '10', displayName: 'Website' },
            { id: '11', displayName: '' },
          ],
        },
        { id: '2', displayName: '', properties: [{ id: '20', displayName: 'Website' }] },
        { id: '3', displayName: 'Empty', properties: [] },
      ],
    }),
    [
      { id: '10', label: 'Grace / Website' },
      { id: '11', label: 'Grace / 11' },
      { id: '20', label: '2 / Website' },
    ],
  );
});

test('ranked bars are sized against the largest row and survive all-zero data', () => {
  assert.deepEqual(
    toRankedBars([
      { label: '/', value: 200 },
      { label: '/about', value: 50 },
      { label: '/give', value: 1 },
    ]).map((row) => row.percent),
    [100, 25, 1],
  );
  assert.deepEqual(toRankedBars([{ label: '/', value: 0 }])[0]?.percent, 0);
  assert.deepEqual(toRankedBars([]), []);
});

test('trend days are labelled as calendar days whatever the viewer time zone', () => {
  assert.equal(formatTrendDay('2026-09-01', 'en'), 'Sep 1');
  assert.match(formatTrendDay('2026-09-01', 'uk'), /^1 /);
});
