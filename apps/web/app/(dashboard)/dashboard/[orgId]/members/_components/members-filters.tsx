'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { QueryFilterMultiSelect } from '@/components/forms/query-filter-multi-select';
import { QueryFilterSelect } from '@/components/forms/query-filter-select';
import { FiltersIcon } from '@/components/icons/action-icons';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import type { MembersFiltersProps } from './members-filters.types';

const FILTERS_BUTTON_CLASS_NAME =
  'flex h-11 shrink-0 cursor-pointer items-center gap-2 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] px-4 font-semibold text-[var(--foreground)] md:hidden';

export function MembersFilters({
  accessOptions,
  accessValue,
  groupOptions,
  groupValue,
  preserved,
  showAccessFilter,
  typeOptions,
  typeValue,
  variant,
}: MembersFiltersProps) {
  const t = useTranslations('members');
  const groupsT = useTranslations('groups');
  const [sheetOpen, setSheetOpen] = useState(false);

  const controls = (
    <>
      <QueryFilterMultiSelect
        label={groupsT('title')}
        labelClassName="sr-only"
        name="groups"
        options={groupOptions}
        placeholder={groupsT('allGroups')}
        preserveParams={{
          access: preserved.access,
          pageSize: preserved.pageSize,
          search: preserved.search,
          tab: preserved.tab,
          type: preserved.type,
        }}
        selectClassName="w-full"
        value={groupValue}
      />
      <div className="filter-bar min-w-0 flex-wrap">
        {showAccessFilter ? (
          <QueryFilterSelect
            label={t('access')}
            labelClassName="sr-only"
            name="access"
            options={accessOptions}
            preserveParams={{
              groups: preserved.groups,
              pageSize: preserved.pageSize,
              search: preserved.search,
              type: preserved.type,
            }}
            size="medium"
            value={accessValue}
          />
        ) : null}
        <QueryFilterSelect
          label={t('type')}
          labelClassName="sr-only"
          name="type"
          options={typeOptions}
          preserveParams={{
            access: preserved.access,
            groups: preserved.groups,
            pageSize: preserved.pageSize,
            search: preserved.search,
            tab: preserved.tab,
          }}
          size="medium"
          value={typeValue}
        />
      </div>
    </>
  );

  if (variant === 'inline') {
    return <div className="hidden md:contents">{controls}</div>;
  }

  return (
    <>
      <button
        aria-expanded={sheetOpen}
        aria-haspopup="dialog"
        className={FILTERS_BUTTON_CLASS_NAME}
        type="button"
        onClick={() => setSheetOpen(true)}
      >
        <FiltersIcon className="h-5 w-5 text-[var(--accent-mobile)]" />
        {t('filters')}
      </button>
      <BottomSheet open={sheetOpen} title={t('filters')} onClose={() => setSheetOpen(false)}>
        <div className="grid gap-3 px-5 pt-1 pb-4">{controls}</div>
      </BottomSheet>
    </>
  );
}
