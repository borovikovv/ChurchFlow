'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import type { OrganizationGroupDetail, OrganizationGroupListItem } from '@churchflow/shared';
import { Button } from '@/components/ui/button';
import { loadGroupDetailsAction } from '../actions';

const CSV_COLUMNS = [
  'group',
  'icon',
  'color',
  'leaders',
  'memberCount',
  'memberNames',
  'responsibilities',
] as const;

export function GroupsCsvExport({
  groups,
  organizationId,
}: {
  groups: OrganizationGroupListItem[];
  organizationId: string;
}) {
  const t = useTranslations('groups');
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exportSummary = async () => {
    setExporting(true);
    try {
      const result = await loadGroupDetailsAction({ organizationId });
      if (!result.ok) {
        setError(result.error);
        return;
      }

      setError(null);
      downloadCsv(buildSummaryCsv(result.groups));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="grid gap-1">
      <Button
        disabled={exporting || groups.length === 0}
        type="button"
        variant="secondary"
        onClick={() => {
          void exportSummary();
        }}
      >
        {exporting ? t('exporting') : t('exportSummary')}
      </Button>
      {error ? <small className="form-error">{error}</small> : null}
    </div>
  );
}

function buildSummaryCsv(groups: OrganizationGroupDetail[]): string {
  const rows = groups.map((group) => [
    group.name,
    group.icon,
    group.color,
    group.members
      .filter((member) => member.role === 'LEADER')
      .map((member) => member.displayName)
      .join('; '),
    String(group.members.length),
    group.members.map((member) => member.displayName).join('; '),
    group.members
      .filter((member) => member.responsibility)
      .map((member) => `${member.displayName}: ${member.responsibility ?? ''}`)
      .join('; '),
  ]);

  return [CSV_COLUMNS.join(','), ...rows.map((row) => row.map(escapeCsvValue).join(','))].join(
    '\n',
  );
}

function downloadCsv(csv: string) {
  // The BOM keeps Excel from reading the UTF-8 names as Latin-1.
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'churchflow-groups.csv';
  link.click();
  URL.revokeObjectURL(url);
}

function escapeCsvValue(value: string): string {
  if (!/[",\n\r]/.test(value)) return value;
  return `"${value.replaceAll('"', '""')}"`;
}
