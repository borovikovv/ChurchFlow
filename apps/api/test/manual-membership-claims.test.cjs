const assert = require('node:assert/strict');
const test = require('node:test');
const { MembershipsService } = require('../dist/modules/memberships/memberships.service.js');
const {
  MembershipClaimsService,
} = require('../dist/modules/membership-claims/membership-claims.service.js');
const {
  MembershipsRepository,
} = require('../dist/modules/memberships/repositories/memberships.repository.js');
const {
  MembershipClaimsRepository,
} = require('../dist/modules/membership-claims/repositories/membership-claims.repository.js');

test('manual member repository atomically creates profile and audit without User', async () => {
  const captured = {};
  const repository = new MembershipsRepository({
    $transaction: async (callback) =>
      callback({
        organization: { findFirst: async () => ({ id: 'organization' }) },
        organizationMember: {
          findFirst: async () => ({ id: 'owner-membership', role: 'OWNER' }),
          create: async ({ data }) => {
            captured.member = data;
            return { id: 'manual-member', ...data, profile: data.profile.create };
          },
        },
        auditLog: { create: async ({ data }) => (captured.audit = data) },
      }),
  });

  await repository.createManualMember(
    'organization',
    { displayName: 'Manual Member', role: 'MEMBER' },
    'owner',
  );

  assert.equal(captured.member.userId, null);
  assert.equal(captured.member.source, 'MANUAL');
  assert.equal(captured.member.profile.create.displayName, 'Manual Member');
  assert.equal(captured.audit.action, 'CREATE_MANUAL_MEMBER');
});

test('ordinary members cannot create manual organization members', async () => {
  const repository = new MembershipsRepository({
    $transaction: async (callback) =>
      callback({
        organization: { findFirst: async () => ({ id: 'organization' }) },
        organizationMember: { findFirst: async () => null },
      }),
  });

  await assert.rejects(
    repository.createManualMember(
      'organization',
      { displayName: 'Manual Member', role: 'MEMBER' },
      'ordinary-member',
    ),
    /ACTOR_CANNOT_MANAGE_MEMBERS/,
  );
});

test('member profile update is tenant-scoped and stores only changed field names in audit', async () => {
  let audit;
  const repository = new MembershipsRepository({
    $transaction: async (callback) =>
      callback({
        organizationMember: {
          findFirst: async ({ where }) => (where.userId ? { id: 'manager' } : null),
        },
        organizationMemberProfile: { upsert: async () => assert.fail('must not update profile') },
        auditLog: { create: async ({ data }) => (audit = data) },
      }),
  });

  await assert.rejects(
    repository.updateProfile(
      'organization',
      'membership-from-another-tenant',
      { notes: 'sensitive note' },
      'manager',
    ),
    /MEMBERSHIP_NOT_FOUND/,
  );
  assert.equal(audit, undefined);
});

test('audit failure aborts manual member creation', async () => {
  const repository = new MembershipsRepository({
    $transaction: async (callback) =>
      callback({
        organization: { findFirst: async () => ({ id: 'organization' }) },
        organizationMember: {
          findFirst: async () => ({ id: 'owner-membership', role: 'OWNER' }),
          create: async ({ data }) => ({ id: 'manual-member', ...data }),
        },
        auditLog: { create: async () => Promise.reject(new Error('audit unavailable')) },
      }),
  });

  await assert.rejects(
    repository.createManualMember(
      'organization',
      { displayName: 'Manual Member', role: 'VIEWER' },
      'owner',
    ),
    /audit unavailable/,
  );
});

test('manual member creation delegates without creating a platform user', async () => {
  let captured;
  const service = new MembershipsService(
    {
      createManualMember: async (organizationId, input, actorUserId) => {
        captured = { organizationId, input, actorUserId };
        return { id: 'manual-member', userId: null, source: 'MANUAL' };
      },
    },
    {},
  );

  const result = await service.createManualMember(
    'organization',
    { displayName: 'Manual Member', role: 'MEMBER' },
    'owner',
  );

  assert.equal(result.userId, null);
  assert.equal(result.source, 'MANUAL');
  assert.equal(captured.input.displayName, 'Manual Member');
});

test('membership claim generation stores a hash and returns only the raw URL', async () => {
  let storedTokenHash;
  const service = new MembershipClaimsService(
    {
      createOrRefresh: async (input) => {
        storedTokenHash = input.tokenHash;
        return {
          claim: { id: 'claim', tokenHash: input.tokenHash },
          organizationName: 'Grace Church',
          profile: null,
        };
      },
    },
    {
      buildMembershipClaimUrl: (token) =>
        `https://churchflow.test/member-claims/accept?token=${token}`,
    },
  );

  const result = await service.generate('organization', 'membership', 'owner');
  const rawToken = new URL(result.claimUrl).searchParams.get('token');

  assert.ok(rawToken);
  assert.equal(storedTokenHash.length, 64);
  assert.notEqual(storedTokenHash, rawToken);
});

test('membership claim email failure does not fail the persisted claim', async () => {
  const service = new MembershipClaimsService(
    {
      createOrRefresh: async (input) => ({
        claim: { id: 'claim', status: 'PENDING', tokenHash: input.tokenHash },
        organizationName: 'Grace Church',
        profile: { email: 'member@example.com' },
      }),
    },
    {
      buildMembershipClaimUrl: (token) =>
        `https://churchflow.test/member-claims/accept?token=${token}`,
      sendMembershipClaimEmail: async () => Promise.reject(new Error('provider unavailable')),
    },
  );

  const result = await service.generate('organization', 'membership', 'owner');
  assert.equal(result.claim.id, 'claim');
  assert.equal(result.emailSent, false);
});

test('public membership claim validation does not expose member PII or Telegram identity', async () => {
  const service = new MembershipClaimsService(
    {
      findByTokenHash: async () => ({
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 60_000),
        providerAccountId: null,
        membership: {
          userId: null,
          status: 'ACTIVE',
          removedAt: null,
          profile: { email: 'private@example.com', phone: '+380000000000', notes: 'private' },
          organization: {
            name: 'Grace Church',
            status: 'ACTIVE',
            deletedAt: null,
          },
        },
      }),
    },
    {},
  );

  const result = await service.validate('raw-token-that-is-long-enough-for-validation');

  assert.deepEqual(Object.keys(result).sort(), [
    'expiresAt',
    'organizationName',
    'requiresAuthentication',
    'valid',
  ]);
  assert.equal('email' in result, false);
  assert.equal('providerAccountId' in result, false);
});

test('revoked membership claim is invalid for public validation', async () => {
  const service = new MembershipClaimsService(
    {
      findByTokenHash: async () => ({
        status: 'REVOKED',
        expiresAt: new Date(Date.now() + 60_000),
        membership: {
          userId: null,
          status: 'ACTIVE',
          removedAt: null,
          organization: { name: 'Grace Church', status: 'ACTIVE', deletedAt: null },
        },
      }),
    },
    {},
  );

  assert.deepEqual(await service.validate('raw-token-that-is-long-enough-for-validation'), {
    valid: false,
  });
});

test('duplicate membership during claim approval returns a conflict', async () => {
  const service = new MembershipClaimsService(
    { approve: async () => ({ conflict: true, expired: false }) },
    {},
  );

  await assert.rejects(
    service.approve('organization', 'claim', 'owner'),
    /already a member of the organization/,
  );
});

test('expired membership claim request is rejected after expiry is persisted', async () => {
  const service = new MembershipClaimsService({ request: async () => ({ expired: true }) }, {});

  await assert.rejects(
    service.request('raw-token-that-is-long-enough-for-validation', 'claimant'),
    /Membership claim has expired/,
  );
});

test('one membership claim token cannot be requested by two Telegram users', async () => {
  const state = { status: 'PENDING', requestedByUserId: null };
  const repository = new MembershipClaimsRepository({
    $transaction: async (callback) =>
      callback({
        membershipClaim: {
          findUnique: async () => ({
            id: 'claim',
            membershipId: 'membership',
            status: state.status,
            requestedByUserId: state.requestedByUserId,
            expiresAt: new Date(Date.now() + 60_000),
            membership: {
              userId: null,
              status: 'ACTIVE',
              removedAt: null,
              organizationId: 'organization',
              organization: { status: 'ACTIVE', deletedAt: null },
            },
          }),
          updateMany: async ({ data }) => {
            if (state.status !== 'PENDING' || state.requestedByUserId !== null) return { count: 0 };
            state.status = data.status;
            state.requestedByUserId = data.requestedByUserId;
            return { count: 1 };
          },
          update: async () => ({}),
        },
        user: {
          findFirst: async ({ where }) => ({
            id: where.id,
            accounts: [{ providerAccountId: `telegram-${where.id}` }],
          }),
        },
        auditLog: { create: async () => ({}) },
      }),
  });

  await repository.request('token-hash', 'user-one');
  await assert.rejects(repository.request('token-hash', 'user-two'), /CLAIM_NOT_PENDING/);
  assert.equal(state.requestedByUserId, 'user-one');
});
