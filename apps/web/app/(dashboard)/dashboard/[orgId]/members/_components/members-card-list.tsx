'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { CardList } from '@/components/ui/card-list';
import { useCursorPagination } from '@/hooks/use-cursor-pagination';
import { loadMembersAction } from '../actions';
import type { MembersPayload, OrganizationMember } from '../types';

type MembersQuery = Omit<Parameters<typeof loadMembersAction>[0], 'cursor'>;

const getMemberKey = (member: OrganizationMember) => member.id;

export function MembersCardList({
  emptyMessage,
  payload,
  query,
  renderCard,
}: {
  emptyMessage: string;
  payload: MembersPayload;
  query: MembersQuery;
  renderCard: (member: OrganizationMember) => ReactNode;
}) {
  const t = useTranslations('pagination');
  const { error, hasMore, isLoading, items, loadMore } = useCursorPagination({
    getItemKey: getMemberKey,
    initialCursor: payload.pagination.nextCursor,
    initialItems: payload.members,
    loadPage: async (cursor) => {
      const result = await loadMembersAction({ ...query, cursor });

      return result.ok
        ? {
            ok: true as const,
            cursor: result.payload.pagination.nextCursor,
            items: result.payload.members,
          }
        : { ok: false as const, error: result.error };
    },
  });

  return (
    <>
      <CardList
        data={items}
        emptyMessage={emptyMessage}
        getCardClassName={(member) => (member.status === 'ARCHIVED' ? 'opacity-75' : undefined)}
        getCardKey={getMemberKey}
        loadMore={{
          autoLoad: true,
          hasMore,
          isLoading,
          label: t('loadMore'),
          loadingLabel: t('loadingMore'),
          onLoadMore: loadMore,
        }}
        renderCard={renderCard}
      />
      {error ? <p className="form-error">{error}</p> : null}
    </>
  );
}
