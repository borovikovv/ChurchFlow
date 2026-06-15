#!/usr/bin/env node
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';

const VALID_ROLES = new Set(['ADMIN', 'SUPER_ADMIN']);

function parseArgs(argv) {
  const args = argv.slice(2);
  const email = args[0]?.trim().toLowerCase();
  const role = (args[1] ?? 'SUPER_ADMIN').trim().toUpperCase();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Usage: pnpm admin:promote <email> [ADMIN|SUPER_ADMIN]');
  }

  if (!VALID_ROLES.has(role)) {
    throw new Error('Role must be ADMIN or SUPER_ADMIN');
  }

  return { email, role };
}

async function main() {
  const { email, role } = parseArgs(process.argv);
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    await client.query('begin');

    const existing = await client.query(
      'select id, platform_role, deleted_at from users where email = $1 limit 1',
      [email],
    );

    if (existing.rows[0]?.deleted_at) {
      throw new Error(`User ${email} is soft-deleted; restore deliberately before promotion`);
    }

    const userId = existing.rows[0]?.id ?? randomUUID();
    const previousRole = existing.rows[0]?.platform_role ?? null;

    if (existing.rows[0]) {
      await client.query(
        'update users set platform_role = $1, updated_at = now() where id = $2',
        [role, userId],
      );
    } else {
      await client.query(
        'insert into users (id, email, platform_role) values ($1, $2, $3)',
        [userId, email, role],
      );
    }

    await client.query(
      `insert into audit_logs (id, action, entity_type, entity_id, metadata)
       values ($1, $2, $3, $4, $5::jsonb)`,
      [
        randomUUID(),
        'PROMOTE_PLATFORM_ADMIN',
        'User',
        userId,
        JSON.stringify({
          email,
          previousRole,
          role,
          source: 'admin_promote_cli',
        }),
      ],
    );

    await client.query('commit');
    console.log(`Promoted ${email} to ${role}`);
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
