const assert = require('node:assert/strict');
const test = require('node:test');
const {
  createMembersCsvTemplate,
  parseMembersCsv,
} = require('../dist/modules/memberships/member-csv-import.js');

test('member CSV import parses quoted values and ministries', () => {
  const csv = [
    'displayName,email,phone,role,ministries,memberSince,birthday,anniversary,notes,biography,familyNotes',
    '"Jane, Doe",jane@example.com,+380501112233,MEMBER,WORSHIP;TEACHER,2024-01-14,1991-05-20,,,"Bio, with comma",',
  ].join('\n');

  const result = parseMembersCsv(csv);

  assert.equal(result.totalRows, 1);
  assert.deepEqual(result.errors, []);
  assert.equal(result.rows[0].displayName, 'Jane, Doe');
  assert.equal(result.rows[0].email, 'jane@example.com');
  assert.deepEqual(result.rows[0].ministries, ['WORSHIP', 'TEACHER']);
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
    'displayName,email,phone,role,ministries,memberSince,birthday,anniversary,notes,biography,familyNotes',
  );
});
