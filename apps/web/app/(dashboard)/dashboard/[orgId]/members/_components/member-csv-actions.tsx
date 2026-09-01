'use client';

import { createMembersCsvTemplate } from '@churchflow/shared';
import { useTranslations } from 'next-intl';
import { useRef, useTransition } from 'react';
import { toast } from 'react-toastify';
import { ActionMenuButton } from '@/components/ui/action-menu-button';
import { importMembersCsvAction } from '../actions';

export function MemberCsvActions({
  triggerClassName,
  wrapperClassName,
  organizationId,
  onImported,
}: {
  triggerClassName?: string | undefined;
  wrapperClassName?: string | undefined;
  organizationId: string;
  onImported: () => void;
}) {
  const t = useTranslations('members');
  const inputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();

  const importFile = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast.error(t('chooseCsvFile'));
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
          t('importedMembersWithFailures', {
            created: importResult.result.createdCount,
            failed: importResult.result.failedCount,
          }),
        );
      } else {
        toast.success(t('importedMembers', { created: importResult.result.createdCount }));
      }
    });
  };

  return (
    <div
      className={['flex flex-col md:items-end gap-2', wrapperClassName].filter(Boolean).join(' ')}
    >
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
        className={triggerClassName}
        icon={<PlusIcon />}
        label={isPending ? t('importing') : t('addMembers')}
        size="medium"
        items={[
          {
            icon: <DownloadIcon />,
            label: t('downloadCsvTemplate'),
            onSelect: downloadTemplate,
          },
          {
            icon: <UploadIcon />,
            label: t('importFromCsv'),
            onSelect: () => inputRef.current?.click(),
          },
        ]}
      />
    </div>
  );
}

function downloadTemplate() {
  const blob = new Blob([createMembersCsvTemplate()], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'churchflow-members-template.csv';
  link.click();
  URL.revokeObjectURL(url);
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
