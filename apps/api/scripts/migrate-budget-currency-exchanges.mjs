#!/usr/bin/env node
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';

// Currency exchanges used to be recorded as two unrelated budget entries in the CURRENCY_EXCHANGE
// group, which inflated both income and expenses. This moves the pairs that are unambiguous into
// budget_exchanges and zeroes the entries they came from. Anything ambiguous is left untouched and
// reported, so a human can fix it in the UI.

const INCOME_CATEGORY = 'UAH from exchange';
const SPENT_CATEGORIES = new Map([
  ['USD spent', { currency: 'USD', column: 'amountUsd' }],
  ['EUR spent', { currency: 'EUR', column: 'amountEur' }],
]);

const localEnvPath = fileURLToPath(new URL('../.env', import.meta.url));

if (process.env.NODE_ENV !== 'production' && existsSync(localEnvPath)) {
  loadEnvFile(localEnvPath);
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const organizationId = args.find((value) => value.startsWith('--organization='))?.split('=')[1];

  return {
    dryRun: args.includes('--dry-run'),
    ...(organizationId ? { organizationId } : {}),
  };
}

async function main() {
  const { dryRun, organizationId } = parseArgs(process.argv);
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL must be set in apps/api/.env or the deployment environment');
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const rows = await loadExchangeEntries(client, organizationId);
    const groups = groupByRow(rows);
    const migrated = [];
    const skipped = [];

    for (const group of groups.values()) {
      const pair = toExchangePair(group);
      if (pair) migrated.push(pair);
      else skipped.push(group);
    }

    if (!dryRun) {
      await client.query('begin');
      try {
        for (const pair of migrated) {
          await insertExchange(client, pair);
        }
        await client.query('commit');
      } catch (error) {
        await client.query('rollback');
        throw error;
      }
    }

    report({ dryRun, migrated, skipped });
  } finally {
    await client.end();
  }
}

async function loadExchangeEntries(client, organizationId) {
  const result = await client.query(
    `select e.id as entry_id, e.row_index, e.amount_uah, e.amount_usd, e.amount_eur,
            c.name as category_name,
            m.id as month_id, m.organization_id, m.year, m.month
     from budget_entries e
     join budget_categories c on c.id = e.category_id
     join budget_months m on m.id = e.month_id
     where c."group" = 'CURRENCY_EXCHANGE'
       and c.deleted_at is null
       and (e.amount_uah <> 0 or e.amount_usd <> 0 or e.amount_eur <> 0)
       and ($1::uuid is null or m.organization_id = $1::uuid)
     order by m.organization_id, m.year, m.month, e.row_index`,
    [organizationId ?? null],
  );

  return result.rows.map((row) => ({
    entryId: row.entry_id,
    rowIndex: row.row_index,
    amountUah: Number(row.amount_uah),
    amountUsd: Number(row.amount_usd),
    amountEur: Number(row.amount_eur),
    categoryName: row.category_name,
    monthId: row.month_id,
    organizationId: row.organization_id,
    year: row.year,
    month: row.month,
  }));
}

function groupByRow(rows) {
  const groups = new Map();

  for (const row of rows) {
    const key = `${row.monthId}:${String(row.rowIndex)}`;
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }

  return groups;
}

// A pair is unambiguous only when the row holds exactly one hryvnia leg and one foreign leg, each
// carrying a single currency. Anything else could mean several exchanges typed into one row.
function toExchangePair(group) {
  if (group.length !== 2) return null;

  const received = group.find((row) => row.categoryName === INCOME_CATEGORY);
  const spent = group.find((row) => SPENT_CATEGORIES.has(row.categoryName));
  if (!received || !spent) return null;

  const spentCurrency = SPENT_CATEGORIES.get(spent.categoryName);
  if (!isOnly(received, 'amountUah') || !isOnly(spent, spentCurrency.column)) return null;

  const fromAmount = spent[spentCurrency.column];
  const toAmount = received.amountUah;

  return {
    organizationId: received.organizationId,
    monthId: received.monthId,
    occurredOn: lastDayOfMonth(received.year, received.month),
    fromCurrency: spentCurrency.currency,
    fromAmount,
    toCurrency: 'UAH',
    toAmount,
    dealRate: toAmount / fromAmount,
    entryIds: [received.entryId, spent.entryId],
    year: received.year,
    month: received.month,
  };
}

function isOnly(row, column) {
  const columns = ['amountUah', 'amountUsd', 'amountEur'];

  return row[column] > 0 && columns.every((name) => name === column || row[name] === 0);
}

function lastDayOfMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

async function insertExchange(client, pair) {
  const officialRate = await client.query(
    `select case when $2 = 'USD' then usd_to_uah else eur_to_uah end as rate
     from currency_rates
     where date <= $1::date
     order by date desc
     limit 1`,
    [pair.occurredOn, pair.fromCurrency],
  );
  const exchangeId = randomUUID();

  await client.query(
    `insert into budget_exchanges
       (id, organization_id, month_id, occurred_on, from_currency, from_amount,
        to_currency, to_amount, deal_rate, official_rate, created_at, updated_at)
     values ($1, $2, $3, $4::date, $5::"BudgetCurrency", $6, $7::"BudgetCurrency", $8, $9, $10, now(), now())`,
    [
      exchangeId,
      pair.organizationId,
      pair.monthId,
      pair.occurredOn,
      pair.fromCurrency,
      pair.fromAmount,
      pair.toCurrency,
      pair.toAmount,
      pair.dealRate,
      officialRate.rows[0]?.rate ?? null,
    ],
  );

  await client.query(
    `update budget_entries
     set amount_uah = 0, amount_usd = 0, amount_eur = 0, updated_at = now()
     where id = any($1::uuid[])`,
    [pair.entryIds],
  );

  await client.query(
    `insert into audit_logs (id, organization_id, action, entity_type, entity_id, metadata)
     values ($1, $2, $3, $4, $5, $6::jsonb)`,
    [
      randomUUID(),
      pair.organizationId,
      'MIGRATE_BUDGET_EXCHANGE',
      'Budget',
      exchangeId,
      JSON.stringify({
        year: pair.year,
        month: pair.month,
        from: `${pair.fromAmount.toFixed(2)} ${pair.fromCurrency}`,
        to: `${pair.toAmount.toFixed(2)} ${pair.toCurrency}`,
        source: 'currency_exchange_categories',
      }),
    ],
  );
}

function report({ dryRun, migrated, skipped }) {
  const prefix = dryRun ? '[dry run] ' : '';
  console.log(`${prefix}migrated ${String(migrated.length)} currency exchange pairs`);

  if (skipped.length === 0) return;

  console.log(`${prefix}left untouched: ${String(skipped.length)} rows that are not a clean pair`);
  for (const group of skipped) {
    const [row] = group;
    console.log(
      `  organization ${row.organizationId} ${String(row.year)}-${String(row.month).padStart(2, '0')} row ${String(row.rowIndex + 1)}: ${group
        .map((entry) => entry.categoryName)
        .join(', ')}`,
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
