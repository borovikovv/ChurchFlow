import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

// en.json is the type source of truth (AppMessages = typeof en), so a key missing from uk.json
// compiles cleanly and only fails in front of a Ukrainian-speaking user. This is the check that
// TypeScript cannot do for us.
function keyPaths(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return [];
  }

  return Object.entries(value).flatMap(([key, nested]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return [path, ...keyPaths(nested, path)];
  });
}

function load(locale: string): unknown {
  return JSON.parse(
    readFileSync(new URL(`../apps/web/messages/${locale}.json`, import.meta.url), 'utf8'),
  );
}

const en = keyPaths(load('en'));
const uk = keyPaths(load('uk'));

test('every English message has a Ukrainian counterpart', () => {
  const missing = en.filter((path) => !uk.includes(path));
  assert.deepEqual(missing, []);
});

test('Ukrainian carries no message English does not have', () => {
  const extra = uk.filter((path) => !en.includes(path));
  assert.deepEqual(extra, []);
});
