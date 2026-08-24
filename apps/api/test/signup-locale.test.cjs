const assert = require('node:assert/strict');
const test = require('node:test');
const { resolveAppLocaleFromAcceptLanguage } = require('@churchflow/shared');

test('a Ukrainian or Russian browser resolves to the Ukrainian locale', () => {
  assert.equal(resolveAppLocaleFromAcceptLanguage('uk-UA,uk;q=0.9,en;q=0.8'), 'uk');
  assert.equal(resolveAppLocaleFromAcceptLanguage('uk'), 'uk');
  assert.equal(resolveAppLocaleFromAcceptLanguage('ru-RU,ru;q=0.9'), 'uk');
  assert.equal(resolveAppLocaleFromAcceptLanguage('en-UA,en;q=0.9'), 'uk');
});

test('any other browser language resolves to English', () => {
  assert.equal(resolveAppLocaleFromAcceptLanguage('en-US,en;q=0.9'), 'en');
  assert.equal(resolveAppLocaleFromAcceptLanguage('pl-PL,pl;q=0.9,de;q=0.8'), 'en');
  assert.equal(resolveAppLocaleFromAcceptLanguage(undefined), 'en');
  assert.equal(resolveAppLocaleFromAcceptLanguage(''), 'en');
});

test('the highest quality supported language wins', () => {
  assert.equal(resolveAppLocaleFromAcceptLanguage('en-US,en;q=0.9,uk;q=0.5'), 'en');
  assert.equal(resolveAppLocaleFromAcceptLanguage('de-DE,uk;q=0.8,en;q=0.6'), 'uk');
  assert.equal(resolveAppLocaleFromAcceptLanguage('uk;q=0, en;q=0.5'), 'en');
});
