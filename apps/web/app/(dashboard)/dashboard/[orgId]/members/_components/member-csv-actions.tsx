'use client';

import { MEMBER_CSV_TEMPLATE_COLUMNS } from '@churchflow/shared';
import { useRef, useTransition } from 'react';
import { toast } from 'react-toastify';
import { ActionMenuButton } from '@/components/ui/action-menu-button';
import { importMembersCsvAction } from '../actions';

export function MemberCsvActions({
  organizationId,
  onImported,
}: {
  organizationId: string;
  onImported: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();

  const importFile = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast.error('Choose a .csv file.');
      return;
    }

    const formData = new FormData();
    formData.set('organizationId', organizationId);
    formData.set('file', file);

    startTransition(async () => {
      const importResult = await importMembersCsvAction(formData);
      if (!importResult.ok) {
        toast.error(importResult.error);
        return;
      }

      if (importResult.result.members.length > 0) {
        onImported();
      }

      if (importResult.result.failedCount > 0) {
        toast.warning(
          `Imported ${importResult.result.createdCount} members. ${importResult.result.failedCount} rows need fixes.`,
        );
      } else {
        toast.success(`Imported ${importResult.result.createdCount} members.`);
      }
    });
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <input
        accept=".csv,text/csv"
        className="sr-only"
        disabled={isPending}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = '';
          if (file) importFile(file);
        }}
        ref={inputRef}
        type="file"
      />
      <ActionMenuButton
        icon={<PlusIcon />}
        label={isPending ? 'Importing...' : 'Add members'}
        size="full"
        items={[
          {
            icon: <DownloadIcon />,
            label: 'Download CSV template',
            onSelect: downloadTemplate,
          },
          {
            icon: <UploadIcon />,
            label: 'Import from CSV',
            onSelect: () => inputRef.current?.click(),
          },
        ]}
      />
    </div>
  );
}

function downloadTemplate() {
  const blob = new Blob([createTemplateCsv()], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'churchflow-members-template.csv';
  link.click();
  URL.revokeObjectURL(url);
}

function createTemplateCsv(): string {
  return [
    MEMBER_CSV_TEMPLATE_COLUMNS.join(','),
    [
      'Jane Doe',
      'jane@example.com',
      '+380501112233',
      'MEMBER',
      'WORSHIP;TEACHER',
      '2024-01-14',
      '1991-05-20',
      '',
      'Small group leader',
      '',
      '',
    ]
      .map(escapeCsvValue)
      .join(','),
  ].join('\n');
}

function escapeCsvValue(value: string): string {
  if (!/[",\n\r]/.test(value)) return value;
  return `"${value.replaceAll('"', '""')}"`;
}

function PlusIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2.5"
      viewBox="0 0 24 24"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M12 21V9m0 0 4 4m-4-4-4 4M5 3h14" />
    </svg>
  );
}
