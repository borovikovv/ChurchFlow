import assert from 'node:assert/strict';
import test from 'node:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// AuditLog.action is a free-form string written at each call site in the API, so nothing at
// compile time ties a new action to a label. The dashboard renders `home.auditActions.<action>`,
// and a missing key shows up to users as the raw action name.
const API_SRC = new URL('../apps/api/src/', import.meta.url);
const WEB_MESSAGES = new URL('../apps/web/messages/', import.meta.url);

// Written without an organizationId, so they never reach the organization audit feed.
const USER_SCOPED_ACTIONS = new Set(['LOGIN']);

// Every way the API writes an audit row. The row's action is the `action:` inside the call's
// arguments; a call that passes a variable through (shorthand `action,`) is not covered.
const AUDIT_WRITE = /\b(?:auditLog\.create|auditService\.record|recordBudgetAudit)\(/g;
// `action: 'X'` or `action: cond ? 'X' : 'Y'`, possibly split across lines.
const ACTION_ASSIGNMENT = /\baction:\s*([^,;]*)/;
const UPPERCASE_LITERAL = /'([A-Z][A-Z_]*)'/g;

// The text between a call's opening parenthesis and its matching closing one.
function callArguments(source: string, openIndex: number): string {
  let depth = 0;
  for (let index = openIndex; index < source.length; index += 1) {
    if (source[index] === '(') depth += 1;
    if (source[index] === ')') depth -= 1;
    if (depth === 0) return source.slice(openIndex + 1, index);
  }
  return source.slice(openIndex + 1);
}

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return path.endsWith('.ts') ? [path] : [];
  });
}

function auditActionsWrittenIn(source: string): string[] {
  return [...source.matchAll(AUDIT_WRITE)].flatMap((write) => {
    const args = callArguments(source, write.index + write[0].length - 1);
    const expression = ACTION_ASSIGNMENT.exec(args)?.[1] ?? '';
    // In a ternary only the branches are actions; the condition compares something else.
    const branches = expression.slice(expression.indexOf('?') + 1);
    return [...branches.matchAll(UPPERCASE_LITERAL)].map(([, action]) => action);
  });
}

function auditActionLabelKeys(locale: string): Set<string> {
  const messages = JSON.parse(readFileSync(new URL(`${locale}.json`, WEB_MESSAGES), 'utf8'));
  return new Set(Object.keys(messages.home.auditActions));
}

const writtenActions = new Map<string, Set<string>>();
for (const file of sourceFiles(API_SRC.pathname)) {
  for (const action of auditActionsWrittenIn(readFileSync(file, 'utf8'))) {
    writtenActions.set(
      action,
      new Set(writtenActions.get(action)).add(relative(API_SRC.pathname, file)),
    );
  }
}

test('the scan finds the audit actions the API writes', () => {
  assert.ok(writtenActions.has('CREATE_MANUAL_MEMBER'), 'plain literal');
  assert.ok(writtenActions.has('UPDATE_BUDGET_EXCHANGE'), 'budget helper');
  assert.ok(writtenActions.has('INVITE'), 'audit service');
  assert.ok(writtenActions.has('REFRESH_MEMBERSHIP_CLAIM'), 'ternary branch');
  assert.ok(writtenActions.has('REVOKE_MEMBERSHIP_CLAIM'), 'ternary split across lines');
  assert.ok(!writtenActions.has('REJECTED'), 'ternary condition is not an action');
  assert.ok(writtenActions.has('SYNC_MEMBER_MILESTONE_EVENT'));
});

test('an action outside the audit call is not attributed to it', () => {
  const source = `
    await this.auditService.record({ organizationId, action, entityType: 'Organization' });
    const later = { action: 'NOT_AN_AUDIT_ACTION' };
  `;
  assert.deepEqual(auditActionsWrittenIn(source), []);
});

for (const locale of ['en', 'uk']) {
  test(`every organization audit action the API writes has a ${locale} label`, () => {
    const labels = auditActionLabelKeys(locale);
    const missing = [...writtenActions]
      .filter(([action]) => !USER_SCOPED_ACTIONS.has(action) && !labels.has(action))
      .map(([action, files]) => `${action} (${[...files].join(', ')})`);
    assert.deepEqual(missing, []);
  });
}
