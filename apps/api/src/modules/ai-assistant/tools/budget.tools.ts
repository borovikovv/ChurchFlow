import { tool } from 'ai';
import { z } from 'zod';
import type {
  BudgetCurrency,
  BudgetCurrencyTotals,
  BudgetGroupSummary,
  BudgetMonth,
  BudgetPayload,
  BudgetTotals,
} from '@churchflow/shared';
import { BudgetsController } from '../../budgets/budgets.controller';
import type { BudgetsService } from '../../budgets/budgets.service';
import { zonedDateParts } from '../../calendar-events/recurrence/calendar-recurrence';
import { jsonInput, localized, type AiToolMeta, type AiToolOutput } from './ai-tool';
import type { AiToolRunner } from './ai-tool-runner';

/**
 * The budget is read-only for the assistant on purpose: there is no tool that writes to it, so a
 * model can report on the church's money but never move it.
 */
export const BUDGET_TOOL_META = {
  budgetSummary: {
    name: 'budgetSummary',
    group: 'budget',
    risk: 'READ',
    policy: { ownerRequired: true },
    route: { controller: BudgetsController, handler: 'list' },
  },
} satisfies Record<string, AiToolMeta>;

const CURRENCY_FIELDS: Record<BudgetCurrency, keyof BudgetCurrencyTotals> = {
  UAH: 'amountUah',
  USD: 'amountUsd',
  EUR: 'amountEur',
};

function addTotals(
  total: BudgetCurrencyTotals,
  amounts: BudgetCurrencyTotals,
): BudgetCurrencyTotals {
  return {
    amountUah: total.amountUah + amounts.amountUah,
    amountUsd: total.amountUsd + amounts.amountUsd,
    amountEur: total.amountEur + amounts.amountEur,
  };
}

function isZero(amounts: BudgetCurrencyTotals): boolean {
  return amounts.amountUah === 0 && amounts.amountUsd === 0 && amounts.amountEur === 0;
}

/** Entries summed per category over the chosen months; notes stay out of the model's reach. */
export function budgetCategoryTotals(payload: BudgetPayload, months: BudgetMonth[]) {
  const sums = new Map<string, BudgetCurrencyTotals>();
  for (const entry of months.flatMap((month) => month.entries)) {
    sums.set(
      entry.categoryId,
      addTotals(sums.get(entry.categoryId) ?? { amountUah: 0, amountUsd: 0, amountEur: 0 }, entry),
    );
  }

  return payload.categories.flatMap((category) => {
    const amounts = sums.get(category.id);
    if (!amounts || isZero(amounts)) return [];

    return [{ name: category.name, type: category.type, group: category.group, ...amounts }];
  });
}

export interface BudgetSummaryData {
  period: string;
  baseCurrency: BudgetCurrency;
  totals: BudgetTotals | null;
  openingBalance: BudgetCurrencyTotals;
  months: { month: number; totals: BudgetTotals }[];
  groups: BudgetGroupSummary[] | null;
  categories: ReturnType<typeof budgetCategoryTotals>;
}

export function budgetTools(runner: AiToolRunner, budgetsService: BudgetsService) {
  const { organizationId, userId, locale, timeZone, now } = runner.context;

  return {
    budgetSummary: tool({
      description:
        'Read the church budget for a year, or one month of it: income, expenses, currency exchanges and balance in UAH, USD and EUR, per category and per budget group, plus the opening balance. Only the organization owner can see it. The budget cannot be changed through the assistant.',
      inputSchema: z.object({
        year: z.number().int().min(2000).max(2100).optional().describe('Defaults to this year.'),
        month: z.number().int().min(1).max(12).optional().describe('Omit for the whole year.'),
      }),
      execute: (input, { toolCallId }) =>
        runner.read(
          BUDGET_TOOL_META.budgetSummary,
          toolCallId,
          jsonInput(input),
          async (): Promise<AiToolOutput<BudgetSummaryData>> => {
            const year = input.year ?? zonedDateParts(now, timeZone).year;
            const payload = await budgetsService.list(organizationId, year, userId);
            const months = input.month
              ? payload.months.filter((month) => month.month === input.month)
              : payload.months;
            const period = input.month
              ? `${String(year)}-${String(input.month).padStart(2, '0')}`
              : String(year);
            const link = {
              kind: 'budget' as const,
              id: null,
              label: localized(locale, { en: 'Budget', uk: 'Бюджет' }),
            };

            const [selectedMonth] = months;
            if (input.month && !selectedMonth) {
              return {
                ok: true,
                summary: localized(locale, {
                  en: `The budget has no records for ${period}.`,
                  uk: `У бюджеті немає записів за ${period}.`,
                }),
                links: [link],
                data: {
                  period,
                  baseCurrency: payload.baseCurrency,
                  totals: null,
                  openingBalance: payload.openingBalance.opening,
                  months: [],
                  groups: null,
                  categories: [],
                },
              };
            }

            const totals = selectedMonth && input.month ? selectedMonth.totals : payload.yearTotals;
            const field = CURRENCY_FIELDS[payload.baseCurrency];
            const amount = (value: number) => `${value.toFixed(2)} ${payload.baseCurrency}`;

            return {
              ok: true,
              summary: localized(locale, {
                en: `Budget ${period}: income ${amount(totals.income[field])}, expenses ${amount(totals.expense[field])}, balance ${amount(totals.balance[field])}.`,
                uk: `Бюджет ${period}: дохід ${amount(totals.income[field])}, витрати ${amount(totals.expense[field])}, залишок ${amount(totals.balance[field])}.`,
              }),
              links: [link],
              data: {
                period,
                baseCurrency: payload.baseCurrency,
                totals,
                openingBalance: payload.openingBalance.opening,
                months: months.map((month) => ({ month: month.month, totals: month.totals })),
                groups: input.month ? null : payload.groupSummaries,
                categories: budgetCategoryTotals(payload, months),
              },
            };
          },
        ),
    }),
  };
}
