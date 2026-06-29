#!/usr/bin/env node
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';

const DEFAULT_TTL_MINUTES = 15;
const MAX_TTL_MINUTES = 60;
const localEnvPath = fileURLToPath(new URL('../.env', import.meta.url));

if (process.env.NODE_ENV !== 'production' && existsSync(localEnvPath)) {
  loadEnvFile(localEnvPath);
}

function parseTtlMinutes(argv) {
  const argument = argv.slice(2).find((value) => value.startsWith('--ttl-minutes='));
  const value = argument ? Number(argument.split('=')[1]) : DEFAULT_TTL_MINUTES;

  if (!Number.isInteger(value) || value < 5 || value > MAX_TTL_MINUTES) {
    throw new Error(`--ttl-minutes must be an integer between 5 and ${MAX_TTL_MINUTES}`);
  }

  return value;
}

async function main() {
  if (process.env.CI) {
    throw new Error('Refusing to print a bootstrap URL in CI logs; use a protected interactive shell');
  }

  const databaseUrl = process.env.DATABASE_URL;
  const webAppUrl = process.env.WEB_APP_URL;
  if (!databaseUrl || !webAppUrl) {
    throw new Error(
      'DATABASE_URL and WEB_APP_URL must be set in apps/api/.env or the deployment environment',
    );
  }

  const ttlMinutes = parseTtlMinutes(process.argv);
  const rawToken = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(rawToken).digest('hex');
  const tokenId = randomUUID();
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    await client.query('begin');
    await client.query("select pg_advisory_xact_lock(hashtext('churchflow:platform-admin-bootstrap'))");

    const existingAdmin = await client.query(
      `select id from users
       where platform_role = 'SUPER_ADMIN' and deleted_at is null
       limit 1`,
    );
    if (existingAdmin.rowCount > 0) {
      throw new Error('An active SUPER_ADMIN already exists; bootstrap is disabled');
    }

    const activeBootstrap = await client.query(
      `select id from platform_admin_bootstrap_tokens
       where consumed_at is null and expires_at > now()
       limit 1`,
    );
    if (activeBootstrap.rowCount > 0) {
      throw new Error('An unexpired platform admin bootstrap already exists');
    }

    await client.query(
      `insert into platform_admin_bootstrap_tokens
         (id, token_hash, expires_at, created_at)
       values ($1, $2, $3, now())`,
      [tokenId, tokenHash, expiresAt],
    );

    await client.query(
      `insert into audit_logs (id, action, entity_type, entity_id, metadata)
       values ($1, $2, $3, $4, $5::jsonb)`,
      [
        randomUUID(),
        'CREATE_PLATFORM_ADMIN_BOOTSTRAP',
        'PlatformAdminBootstrapToken',
        tokenId,
        JSON.stringify({ expiresAt: expiresAt.toISOString(), source: 'admin_bootstrap_cli' }),
      ],
    );

    await client.query('commit');

    const url = new URL('/platform-admin/bootstrap', webAppUrl);
    url.searchParams.set('token', rawToken);
    console.log(`One-time bootstrap URL (expires ${expiresAt.toISOString()}):`);
    console.log(url.toString());
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
