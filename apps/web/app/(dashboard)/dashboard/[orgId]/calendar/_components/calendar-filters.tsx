'use client';

import type { CalendarEventType } from '@churchflow/shared';
import { useTranslations } from 'next-intl';
import { Checkbox } from '@/components/ui/checkbox';
import { EVENT_TYPES, EVENT_TYPE_DOT_STYLES } from './calendar-constants';

/**
 * Doubles as the legend: each checkbox carries the colour used by that event type in the grid.
 */
export function CalendarFilters({
  visibleTypes,
  onToggle,
}: {
  visibleTypes: CalendarEventType[];
  onToggle: (type: CalendarEventType) => void;
}) {
  const t = useTranslations('calendar');

  return (
    <div
      aria-label={t('filtersLabel')}
      className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2"
      role="group"
    >
      {EVENT_TYPES.map((type) => (
        <Checkbox
          checked={visibleTypes.includes(type.value)}
          key={type.value}
          label={
            <span className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className={`h-2.5 w-2.5 shrink-0 rounded-full ${EVENT_TYPE_DOT_STYLES[type.value]}`}
              />
              {t(`eventTypeGroups.${type.value}`)}
            </span>
          }
          labelClassName="shrink-0"
          onChange={() => onToggle(type.value)}
        />
      ))}
    </div>
  );
}
