'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useRef, useState, useTransition } from 'react';
import { PlusIcon } from '@/components/icons/action-icons';
import { ActionMenuButton } from '@/components/ui/action-menu-button';
import { Tabs } from '@/components/ui/tabs';
import {
  organizationImportantDatesRoute,
  organizationKnowledgeRoute,
} from '@/features/organizations/routes';
import {
  createImportantDateAction,
  createKnowledgeEntryAction,
  deleteImportantDateAction,
  deleteKnowledgeEntryAction,
  loadImportantDatesAction,
  loadKnowledgeEntriesAction,
  updateImportantDateAction,
  updateKnowledgeEntryAction,
} from '../actions';
import type { KnowledgePageQuery, KnowledgeView } from '../knowledge-page-query';
import { ImportantDateFormDialog } from './important-date-form-dialog';
import { ImportantDatesCardList } from './important-dates-card-list';
import { ImportantDatesTable } from './important-dates-table';
import { KnowledgeFilters } from './knowledge-filters';
import type { ImportantDatesListProps, KnowledgeNotesListProps } from './knowledge-lists.types';
import type { KnowledgeMutationResult, KnowledgeViewData } from './knowledge-manager.types';
import { KnowledgeNoteFormDialog } from './knowledge-note-form-dialog';
import { KnowledgeNotesCardList } from './knowledge-notes-card-list';
import { KnowledgeNotesTable } from './knowledge-notes-table';

export function KnowledgeManager({
  initialData,
  organizationId,
  query,
}: {
  initialData: KnowledgeViewData;
  organizationId: string;
  query: KnowledgePageQuery;
}) {
  const t = useTranslations('knowledge');
  const router = useRouter();
  const [data, setData] = useState(initialData);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const noteDialogRef = useRef<HTMLDialogElement>(null);
  const dateDialogRef = useRef<HTMLDialogElement>(null);
  const { canManage, assignableVisibilities } = data.payload;
  const filtered = Boolean(query.search || query.category || query.tag || query.pinned);
  const notesHref = organizationKnowledgeRoute(organizationId);
  const datesHref = organizationImportantDatesRoute(organizationId);

  async function reload() {
    if (data.view === 'notes') {
      const result = await loadKnowledgeEntriesAction({ organizationId, query });
      if (result.ok) setData({ view: 'notes', payload: result.payload });
      else setError(result.error);
      return;
    }

    const result = await loadImportantDatesAction({ organizationId, query });
    if (result.ok) setData({ view: 'dates', payload: result.payload });
    else setError(result.error);
  }

  /** A change to the view on screen is reloaded in place; one to the other view opens it. */
  function mutate(
    target: KnowledgeView,
    run: () => Promise<KnowledgeMutationResult>,
    onSuccess?: () => void,
  ) {
    setError(null);
    startTransition(async () => {
      const result = await run();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onSuccess?.();
      if (target === data.view) await reload();
      else router.push(target === 'dates' ? datesHref : notesHref);
    });
  }

  async function remove(run: () => Promise<KnowledgeMutationResult>) {
    setError(null);
    const result = await run();
    if (!result.ok) {
      setError(result.error);
      return;
    }
    await reload();
  }

  const notesListProps = (
    payload: KnowledgeNotesListProps['payload'],
  ): KnowledgeNotesListProps => ({
    disabled: isPending,
    filtered,
    payload,
    onUpdate: (entryId, entry) =>
      mutate('notes', () => updateKnowledgeEntryAction({ organizationId, entryId, entry })),
    onDelete: (entry) =>
      remove(() => deleteKnowledgeEntryAction({ organizationId, entryId: entry.id })),
  });
  const datesListProps = (
    payload: ImportantDatesListProps['payload'],
  ): ImportantDatesListProps => ({
    filtered,
    payload,
    onUpdate: (dateId, date) =>
      mutate('dates', () => updateImportantDateAction({ organizationId, dateId, date })),
    onDelete: (date) =>
      remove(() => deleteImportantDateAction({ organizationId, dateId: date.id })),
  });

  return (
    <section className="stack min-w-0">
      <div className="flex min-w-0 flex-col justify-between gap-3 md:flex-row md:items-start">
        <Tabs
          label={t('viewsLabel')}
          items={[
            { label: t('notesTab'), href: notesHref, active: data.view === 'notes' },
            { label: t('datesTab'), href: datesHref, active: data.view === 'dates' },
          ]}
        />
        {canManage ? (
          <ActionMenuButton
            icon={<PlusIcon />}
            label={t('add')}
            size="medium"
            items={[
              { label: t('addNote'), onSelect: () => noteDialogRef.current?.showModal() },
              { label: t('addDate'), onSelect: () => dateDialogRef.current?.showModal() },
            ]}
          />
        ) : null}
      </div>

      <KnowledgeFilters query={query} tags={data.view === 'notes' ? data.payload.tags : []} />

      {error ? <p className="form-error">{error}</p> : null}

      {data.view === 'notes' ? (
        <>
          <div className="md:hidden">
            <KnowledgeNotesCardList {...notesListProps(data.payload)} />
          </div>
          <div className="hidden md:block">
            <KnowledgeNotesTable {...notesListProps(data.payload)} />
          </div>
        </>
      ) : (
        <>
          <div className="md:hidden">
            <ImportantDatesCardList {...datesListProps(data.payload)} />
          </div>
          <div className="hidden md:block">
            <ImportantDatesTable {...datesListProps(data.payload)} />
          </div>
        </>
      )}

      {canManage ? (
        <>
          <KnowledgeNoteFormDialog
            assignableVisibilities={assignableVisibilities}
            dialogRef={noteDialogRef}
            title={t('createNoteTitle')}
            onSubmit={(entry, closeDialog) =>
              mutate(
                'notes',
                () => createKnowledgeEntryAction({ organizationId, entry }),
                closeDialog,
              )
            }
          />
          <ImportantDateFormDialog
            assignableVisibilities={assignableVisibilities}
            dialogRef={dateDialogRef}
            title={t('createDateTitle')}
            onSubmit={(date, closeDialog) =>
              mutate(
                'dates',
                () => createImportantDateAction({ organizationId, date }),
                closeDialog,
              )
            }
          />
        </>
      ) : null}
    </section>
  );
}
