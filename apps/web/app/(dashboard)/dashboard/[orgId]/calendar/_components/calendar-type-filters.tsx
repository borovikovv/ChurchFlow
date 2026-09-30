'use client';

import type { CalendarEventType } from '@churchflow/shared';
import { useTranslations } from 'next-intl';
import { Checkbox } from '@/components/ui/checkbox';
import { EVENT_TYPES, EVENT_TYPE_DOT_STYLES } from './calendar-constants';

export function CalendarTypeFilters({
  labelClassName,
  visibleTypes,
  onFilterToggle,
}: {
  labelClassName?: string;
  visibleTypes: CalendarEventType[];
  onFilterToggle: (type: CalendarEventType) => void;
}) {
  const t = useTranslations('calendar');

  return EVENT_TYPES.map((type) => (
    <Checkbox
      checked={visibleTypes.includes(type.value)}
      key={type.value}
      label={
        <span className="inline-flex items-center gap-2">
          <span
            aria-hidden="true"
            className={`h-2.5 w-2.5 shrink-0 rounded-full md:hidden ${EVENT_TYPE_DOT_STYLES[type.value]}`}
          />
          {t(`eventTypeGroups.${type.value}`)}
        </span>
      }
      labelClassName={labelClassName}
      onChange={() => onFilterToggle(type.value)}
    />
  ));
}
