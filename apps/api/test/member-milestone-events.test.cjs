const assert = require('node:assert/strict');
const test = require('node:test');

const {
  syncMemberMilestoneEvents,
} = require('../dist/modules/calendar-events/member-milestone-events.js');

function kyivDate(value) {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Kyiv',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value);
}

function createTx({ existing = null } = {}) {
  const calls = { created: [], updated: [], audits: [] };

  return {
    calls,
    tx: {
      calendarEvent: {
        findFirst: async ({ where }) => (where.type === 'BIRTHDAY' ? existing : null),
        create: async ({ data }) => {
          calls.created.push(data);
          return { id: 'created-event' };
        },
        update: async ({ where, data }) => {
          calls.updated.push({ id: where.id, data });
          return { id: where.id };
        },
      },
      auditLog: { create: async ({ data }) => calls.audits.push(data) },
    },
  };
}

const baseInput = {
  organizationId: 'organization',
  membershipId: 'membership',
  displayName: 'Maria',
  birthday: null,
  anniversary: null,
  locale: 'uk',
  actorUserId: 'actor',
};

test('a birthday creates one all-day yearly event on the profile date', async () => {
  const { tx, calls } = createTx();

  await syncMemberMilestoneEvents(tx, {
    ...baseInput,
    birthday: new Date('1990-05-14T00:00:00.000Z'),
  });

  assert.equal(calls.created.length, 1);
  const [event] = calls.created;
  assert.equal(event.type, 'BIRTHDAY');
  assert.equal(event.title, 'День народження: Maria');
  assert.equal(event.allDay, true);
  assert.equal(event.repeatPeriod, 'YEARLY');
  assert.equal(event.linkedMembershipId, 'membership');
  assert.equal(kyivDate(event.startsAt), '1990-05-14');

  assert.equal(calls.audits.length, 1);
  assert.equal(calls.audits[0].action, 'SYNC_MEMBER_MILESTONE_EVENT');
  assert.equal(calls.audits[0].entityType, 'CalendarEvent');
  assert.deepEqual(calls.audits[0].metadata, {
    type: 'BIRTHDAY',
    change: 'created',
    membershipId: 'membership',
  });
});

test('an unchanged birthday writes nothing', async () => {
  const birthday = new Date('1990-05-14T00:00:00.000Z');
  // Derive the stored instant from the sync itself: the Europe/Kyiv offset in 1990 is not today's.
  const first = createTx();
  await syncMemberMilestoneEvents(first.tx, { ...baseInput, birthday });
  const startsAt = first.calls.created[0].startsAt;

  const { tx, calls } = createTx({ existing: { id: 'existing-event', startsAt } });

  await syncMemberMilestoneEvents(tx, { ...baseInput, birthday });

  assert.deepEqual(calls.created, []);
  assert.deepEqual(calls.updated, []);
  assert.deepEqual(calls.audits, []);
});

test('clearing the birthday soft deletes the event instead of dropping the row', async () => {
  const { tx, calls } = createTx({
    existing: { id: 'existing-event', startsAt: new Date('1990-05-13T21:00:00.000Z') },
  });

  await syncMemberMilestoneEvents(tx, { ...baseInput, birthday: null });

  assert.equal(calls.updated.length, 1);
  assert.equal(calls.updated[0].id, 'existing-event');
  assert.ok(calls.updated[0].data.deletedAt instanceof Date);
  assert.equal(calls.audits[0].metadata.change, 'deleted');
});

test('moving the birthday updates the existing event rather than adding another', async () => {
  const { tx, calls } = createTx({
    existing: { id: 'existing-event', startsAt: new Date('1990-05-13T21:00:00.000Z') },
  });

  await syncMemberMilestoneEvents(tx, {
    ...baseInput,
    birthday: new Date('1990-06-02T00:00:00.000Z'),
  });

  assert.deepEqual(calls.created, []);
  assert.equal(calls.updated.length, 1);
  assert.equal(kyivDate(calls.updated[0].data.startsAt), '1990-06-02');
  assert.equal(calls.audits[0].metadata.change, 'updated');
});
