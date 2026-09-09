const assert = require('node:assert/strict');
const test = require('node:test');
const { parseMembersCsv } = require('../dist/modules/memberships/member-csv-import.js');
const { createMembersCsvTemplate } = require('@churchflow/shared');

const ORGANIZATION_GROUPS = [
  { id: '11111111-1111-4111-8111-111111111111', name: 'Worship' },
  { id: '22222222-2222-4222-8222-222222222222', name: 'Teachers' },
];

test('member CSV import parses quoted values and groups', () => {
  const csv = [
    'displayName,email,phone,role,groups,memberSince,birthday,anniversary,notes,biography,familyNotes',
    '"Jane, Doe",jane@example.com,+380501112233,MEMBER,worship;Teachers,2024-01-14,1991-05-20,,,"Bio, with comma",',
  ].join('\n');

  const result = parseMembersCsv(csv, ORGANIZATION_GROUPS);

  assert.equal(result.totalRows, 1);
  assert.deepEqual(result.errors, []);
  assert.equal(result.rows[0].displayName, 'Jane, Doe');
  assert.equal(result.rows[0].email, 'jane@example.com');
  assert.deepEqual(result.rows[0].groups, [ORGANIZATION_GROUPS[0].id, ORGANIZATION_GROUPS[1].id]);
});

test('member CSV import rejects a row naming a group the organization does not have', () => {
  const csv = ['displayName,groups', 'Jane Doe,Worship;Ushers'].join('\n');

  const result = parseMembersCsv(csv, ORGANIZATION_GROUPS);

  assert.equal(result.rows.length, 0);
  assert.deepEqual(result.errors, [
    { row: 2, field: 'groups', message: 'Unknown group "Ushers".' },
  ]);
});

test('member CSV import reports invalid rows without dropping valid rows', () => {
  const csv = [
    'displayName,email,role',
    'Valid Member,valid@example.com,MEMBER',
    'x,not-an-email,OWNER',
  ].join('\n');

  const result = parseMembersCsv(csv);

  assert.equal(result.totalRows, 2);
  assert.equal(result.rows.length, 1);
  assert.equal(result.errors.length, 3);
  assert.deepEqual(result.errors.map((error) => error.field).sort(), [
    'displayName',
    'email',
    'role',
  ]);
});

test('member CSV template uses the expected import headers', () => {
  const template = createMembersCsvTemplate();
  const [headers] = template.split('\n');

  assert.equal(
    headers,
    'displayName,email,phone,role,groups,memberSince,birthday,anniversary,notes,biography,familyNotes',
  );
});

test('member CSV template round-trips through the importer without naming a group', () => {
  const result = parseMembersCsv(createMembersCsvTemplate(), ORGANIZATION_GROUPS);

  assert.deepEqual(result.errors, []);
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].groups, undefined);
});
