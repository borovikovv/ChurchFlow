'use client';

import type { CalendarEventType } from '@churchflow/shared';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { FiltersIcon, PlusIcon } from '@/components/icons/action-icons';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import {
  FILTER_ROW_CLASS_NAME,
  FILTERS_BUTTON_CLASS_NAME,
  NEW_EVENT_BUTTON_CLASS_NAME,
} from './calendar-mobile-actions.styles';
import { CalendarTypeFilters } from './calendar-type-filters';

export function CalendarMobileActions({
  canManage,
  visibleTypes,
  onCreate,
  onFilterToggle,
}: {
  canManage: boolean;
  visibleTypes: CalendarEventType[];
  onCreate: () => void;
  onFilterToggle: (type: CalendarEventType) => void;
}) {
  const t = useTranslations('calendar');
  const [filtersOpen, setFiltersOpen] = useState(false);

  return (
    <div className="flex items-center gap-2 md:hidden">
      <button
        aria-expanded={filtersOpen}
        aria-haspopup="dialog"
        aria-label={t('filters')}
        className={FILTERS_BUTTON_CLASS_NAME}
        type="button"
        onClick={() => setFiltersOpen(true)}
      >
        <FiltersIcon className="h-5 w-5" />
      </button>
      {canManage ? (
        <button
          aria-label={t('newEvent')}
          className={NEW_EVENT_BUTTON_CLASS_NAME}
          type="button"
          onClick={onCreate}
        >
          <PlusIcon className="h-6 w-6" />
        </button>
      ) : null}
      <BottomSheet open={filtersOpen} title={t('filters')} onClose={() => setFiltersOpen(false)}>
        <div className="grid px-5 pb-2">
          <CalendarTypeFilters
            labelClassName={FILTER_ROW_CLASS_NAME}
            visibleTypes={visibleTypes}
            onFilterToggle={onFilterToggle}
          />
        </div>
        <div className="px-5 pt-2 pb-2">
          <Button className="h-11 w-full" type="button" onClick={() => setFiltersOpen(false)}>
            {t('close')}
          </Button>
        </div>
      </BottomSheet>
    </div>
  );
}
