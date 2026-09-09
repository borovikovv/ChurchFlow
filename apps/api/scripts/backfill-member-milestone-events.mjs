#!/usr/bin/env node
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';

const MILESTONE_EVENT_TIME_ZONE = 'Europe/Kyiv';
const MILESTONE_TITLES = {
  en: {
    BIRTHDAY: (name) => `${name} birthday`,
    ANNIVERSARY: (name) => `${name} anniversary`,
  },
  uk: {
    BIRTHDAY: (name) => `День народження: ${name}`,
    ANNIVERSARY: (name) => `Річниця: ${name}`,
  },
};

const localEnvPath = fileURLToPath(new URL('../.env', import.meta.url));

if (process.env.NODE_ENV !== 'production' && existsSync(localEnvPath)) {
  loadEnvFile(localEnvPath);
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const organizationId = args.find((value) => value.startsWith('--organization='))?.split('=')[1];
  const locale = args.find((value) => value.startsWith('--locale='))?.split('=')[1] ?? 'en';
  if (!MILESTONE_TITLES[locale]) {
    throw new Error(`Unsupported --locale=${locale}. Use one of: en, uk`);
  }

  return {
    dryRun: args.includes('--dry-run'),
    locale,
    ...(organizationId ? { organizationId } : {}),
  };
}

async function main() {
  const { dryRun, locale, organizationId } = parseArgs(process.argv);
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL must be set in apps/api/.env or the deployment environment');
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const missing = await loadMissingMilestones(client, organizationId);

    if (!dryRun) {
      await client.query('begin');
      try {
        for (const milestone of missing) {
          await insertMilestoneEvent(client, milestone, locale);
        }
        await client.query('commit');
      } catch (error) {
        await client.query('rollback');
        throw error;
      }
    }

    report({ dryRun, locale, missing });
  } finally {
    await client.end();
  }
}

async function loadMissingMilestones(client, organizationId) {
  const result = await client.query(
    `select m.organization_id, m.id as membership_id, p.display_name, t.type,
            to_char(
              (case when t.type = 'BIRTHDAY' then p.birthday else p.anniversary end),
              'YYYY-MM-DD'
            ) as milestone_date
     from organization_member_profiles p
     join organization_members m on m.id = p.membership_id
     join organizations o on o.id = m.organization_id
     cross join (values ('BIRTHDAY'), ('ANNIVERSARY')) as t(type)
     where m.status = 'ACTIVE'
       and m.removed_at is null
       and o.status = 'ACTIVE'
       and o.deleted_at is null
       and (case when t.type = 'BIRTHDAY' then p.birthday else p.anniversary end) is not null
       and ($1::uuid is null or m.organization_id = $1::uuid)
       and not exists (
         select 1 from calendar_events e
         where e.organization_id = m.organization_id
           and e.linked_membership_id = m.id
           and e.type::text = t.type
           and e.deleted_at is null
       )
     order by m.organization_id, p.display_name, t.type`,
    [organizationId ?? null],
  );

  return result.rows.map((row) => ({
    organizationId: row.organization_id,
    membershipId: row.membership_id,
    displayName: row.display_name,
    type: row.type,
    milestoneDate: row.milestone_date,
  }));
}

async function insertMilestoneEvent(client, milestone, locale) {
  const eventId = randomUUID();
  await client.query(
    `insert into calendar_events
       (id, organization_id, created_by_user_id, linked_membership_id, type, title,
        starts_at, ends_at, all_day, repeat_period, task_completed, created_at, updated_at)
     values ($1, $2, null, $3, $4::"CalendarEventType", $5,
             ($6::date::timestamp at time zone $7), null, true, 'YEARLY', false, now(), now())`,
    [
      eventId,
      milestone.organizationId,
      milestone.membershipId,
      milestone.type,
      MILESTONE_TITLES[locale][milestone.type](milestone.displayName),
      milestone.milestoneDate,
      MILESTONE_EVENT_TIME_ZONE,
    ],
  );

  await client.query(
    `insert into audit_logs (id, organization_id, actor_user_id, action, entity_type, entity_id, metadata, created_at)
     values ($1, $2, null, 'SYNC_MEMBER_MILESTONE_EVENT', 'CalendarEvent', $3, $4::jsonb, now())`,
    [
      randomUUID(),
      milestone.organizationId,
      eventId,
      JSON.stringify({
        type: milestone.type,
        change: 'created',
        membershipId: milestone.membershipId,
        source: 'backfill',
      }),
    ],
  );
}

function report({ dryRun, locale, missing }) {
  const byType = missing.reduce((counts, milestone) => {
    counts[milestone.type] = (counts[milestone.type] ?? 0) + 1;
    return counts;
  }, {});

  console.log(
    JSON.stringify(
      {
        mode: dryRun ? 'dry-run' : 'applied',
        locale,
        created: missing.length,
        byType,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
