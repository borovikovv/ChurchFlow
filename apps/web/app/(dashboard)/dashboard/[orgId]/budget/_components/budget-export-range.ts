import type { BudgetMonth } from '@churchflow/shared';
import type { DateRangeValue } from '@/components/forms/date-range-input';
import { formatCalendarDate, parseCalendarDate } from '@/components/forms/calendar-date';

export function defaultBudgetExportRange(year: number): DateRangeValue {
  return {
    startDate: formatCalendarDate(new Date(year, 0, 1, 12)),
    endDate: formatCalendarDate(new Date(year, 11, 31, 12)),
  };
}

export function budgetExportRangeLabel(range: DateRangeValue): string {
  const startDate = parseCalendarDate(range.startDate);
  const endDate = parseCalendarDate(range.endDate);

  if (!startDate || !endDate) return 'selected period';

  return `${formatRangeDate(startDate)} - ${formatRangeDate(endDate)}`;
}

export function filterBudgetMonthsByRange(
  months: BudgetMonth[],
  year: number,
  range: DateRangeValue | null,
): BudgetMonth[] {
  const startDate = parseCalendarDate(range?.startDate);
  const endDate = parseCalendarDate(range?.endDate);

  if (!startDate || !endDate) return months;

  return months.filter((month) => {
    const monthStart = new Date(year, month.month - 1, 1, 12);
    const monthEnd = new Date(year, month.month, 0, 12);

    return monthStart <= endDate && monthEnd >= startDate;
  });
}

export function budgetMonthsInRange(year: number, range: DateRangeValue | null): number[] | null {
  const startDate = parseCalendarDate(range?.startDate);
  const endDate = parseCalendarDate(range?.endDate);

  if (!startDate || !endDate) return null;

  const startMonth = startDate.getFullYear() < year ? 1 : startDate.getMonth() + 1;
  const endMonth = endDate.getFullYear() > year ? 12 : endDate.getMonth() + 1;

  if (endMonth < 1 || startMonth > 12) return [];

  const firstMonth = Math.max(1, startMonth);
  const lastMonth = Math.min(12, endMonth);

  return Array.from({ length: lastMonth - firstMonth + 1 }, (_, index) => firstMonth + index);
}

function formatRangeDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}
