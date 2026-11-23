#!/usr/bin/env node
// Seeds a throwaway database for the mobile end-to-end tests: one organization, an owner and a
// regular member who both sign in by email code, and a little content to look at.
//
// Idempotent: fixed ids and ON CONFLICT DO NOTHING, so running it twice changes nothing.
// Refuses to touch anything that does not look like a local database.
import { Client } from 'pg';

export const E2E_ORGANIZATION_ID = '00000000-0000-4000-8000-00000000e2e0';
export const E2E_USERS = {
  owner: {
    userId: '00000000-0000-4000-8000-00000000e2e1',
    membershipId: '00000000-0000-4000-8000-00000000e2f1',
    email: 'owner@e2e.churchflow.test',
    displayName: 'E2E Owner',
    role: 'OWNER',
  },
  member: {
    userId: '00000000-0000-4000-8000-00000000e2e2',
    membershipId: '00000000-0000-4000-8000-00000000e2f2',
    email: 'member@e2e.churchflow.test',
    displayName: 'E2E Member',
    role: 'MEMBER',
  },
};

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', 'postgres']);

function assertLocalDatabase(databaseUrl) {
  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed e2e data with NODE_ENV=production');
  }
  const host = new URL(databaseUrl).hostname;
  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(`Refusing to seed e2e data into a non-local database host: ${host}`);
  }
}

async function seed(client) {
  await client.query(
    `INSERT INTO organizations (id, name, slug, description, status, updated_at)
     VALUES ($1, 'E2E Church', 'e2e-church', 'Seeded for mobile end-to-end tests', 'ACTIVE', now())
     ON CONFLICT (id) DO NOTHING`,
    [E2E_ORGANIZATION_ID],
  );

  for (const user of Object.values(E2E_USERS)) {
    await client.query(
      `INSERT INTO users (id, email, "displayName", "emailVerified", locale, updated_at)
       VALUES ($1, $2, $3, now(), 'uk', now())
       ON CONFLICT (id) DO NOTHING`,
      [user.userId, user.email, user.displayName],
    );
    // A confirmed email identity is what email sign-in admits.
    await client.query(
      `INSERT INTO auth_accounts (id, user_id, provider, provider_account_id, updated_at)
       VALUES (gen_random_uuid(), $1, 'email', $2, now())
       ON CONFLICT (provider, provider_account_id) DO NOTHING`,
      [user.userId, user.email],
    );
    await client.query(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status, source, updated_at)
       VALUES ($1, $2, $3, $4, 'ACTIVE', 'EXISTING', now())
       ON CONFLICT (id) DO NOTHING`,
      [user.membershipId, E2E_ORGANIZATION_ID, user.userId, user.role],
    );
    await client.query(
      `INSERT INTO organization_member_profiles (id, membership_id, display_name, email, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, now())
       ON CONFLICT (membership_id) DO NOTHING`,
      [user.membershipId, user.displayName, user.email],
    );
  }

  await client.query(
    `INSERT INTO prayer_requests
       (id, organization_id, author_user_id, author_membership_id, title, description, updated_at)
     VALUES ('00000000-0000-4000-8000-00000000e301', $1, $2, $3,
             'E2E prayer request', 'Seeded so the prayers screen has something to show', now())
     ON CONFLICT (id) DO NOTHING`,
    [E2E_ORGANIZATION_ID, E2E_USERS.member.userId, E2E_USERS.member.membershipId],
  );
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  assertLocalDatabase(databaseUrl);
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query('BEGIN');
    await seed(client);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
  console.log(
    `Seeded e2e organization ${E2E_ORGANIZATION_ID} with ${Object.values(E2E_USERS)
      .map((user) => user.email)
      .join(', ')}`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
