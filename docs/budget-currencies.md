# Budget currencies

The budget records every amount in the currency it was actually held in: hryvnia, dollars, and
euro each have their own column. Nothing is ever stored converted. Conversion happens only when
those three columns have to be collapsed into a single number for a summary or a chart.

## Base currency

`organizations.base_currency` decides which currency a total is expressed in. It defaults to `UAH`
and is changed from the select next to the year on the budget page.

Published rates are quoted against the hryvnia, so any other pair is a cross rate through it:

```
rateToBase(currency, base) = rateToUah(currency) / rateToUah(base)
```

The helpers live in `packages/shared/src/budget-currency.ts` and are shared by the API and the web
application so the arithmetic exists in one place.

## Which rate applies

| What                             | Rate                                                                           |
| -------------------------------- | ------------------------------------------------------------------------------ |
| Opening balance, closing balance | today's rate — these are holdings, worth what they are worth now               |
| Income and expenses of a month   | the rate on the last day of that month, or today while the month is still open |
| Year income and expenses         | the sum of the months, each converted at its own rate                          |

`currency_rates` therefore needs a continuous history, not only the days somebody happened to open
the budget. `CurrencyRatesScheduler` stores the published rate every morning, lookups fall back to
the most recent earlier rate for weekends and holidays, and a day that is missing is fetched from
the NBU by date once and stored.

## Currency exchanges

Buying dollars out of the hryvnia box is neither income nor an expense: the money never leaves the
cash box. It is stored in `budget_exchanges` with both legs, the rate of the deal, and a snapshot
of the rate the NBU published that day.

Totals carry a third bucket next to income and expense:

```
balance = income - expense + exchange
```

The exchange bucket is the signed per-currency movement, so an exchange changes the per-currency
balances while leaving turnover alone. Opening balances carry the same movement forward, otherwise
the following year would start from wrong numbers.

The stored official rate is what makes a deal reviewable. `exchangeRateGain` reports the difference
between what was received and what the published rate would have given, in the currency that was
bought.

### Migrating the old records

Before `budget_exchanges` existed, an exchange was typed as two unrelated entries in the
`CURRENCY_EXCHANGE` group — `UAH from exchange` as income and `USD spent` / `EUR spent` as an
expense. That group no longer exists: the
`20260825140000_drop_budget_currency_exchange_group` migration deletes those categories together
with their entries and notes, so run the script before deploying it or the history is lost.

To move the old history over:

```sh
pnpm --filter @churchflow/api budget:migrate-exchanges -- --dry-run
pnpm --filter @churchflow/api budget:migrate-exchanges
```

The script only migrates rows where the pairing is unambiguous: exactly one hryvnia leg and one
foreign leg in the same row, each carrying a single currency. It creates the exchange, zeroes the
two entries it came from, and writes a `MIGRATE_BUDGET_EXCHANGE` audit event. Everything else is
left untouched and listed in the output so it can be corrected by hand — correct those rows before
the drop migration runs. Run the dry run first: the numbers it reports are the ones the yearly
income and expense totals will drop by.

Accept `--organization=<uuid>` to migrate a single organization.
