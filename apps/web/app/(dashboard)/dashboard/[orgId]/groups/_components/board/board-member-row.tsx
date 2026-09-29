'use client';

import Link from 'next/link';
import { Avatar } from '@/components/ui/avatar';
import { organizationMemberRoute } from '@/features/organizations/routes';
import type { BoardDragSource } from './board.types';
import { useGroupsBoardContext } from './groups-board-context';

export function BoardMemberRow({
  source,
  photoUrl,
  roleLabel,
}: {
  source: BoardDragSource;
  photoUrl: string | null;
  roleLabel?: string;
}) {
  const { organizationId, canManage, pendingMembershipIds, startDrag, endDrag } =
    useGroupsBoardContext();
  const pending = pendingMembershipIds.has(source.membershipId);
  const draggable = canManage && !pending;

  return (
    <li
      aria-busy={pending || undefined}
      className={[
        'nodrag nopan flex min-w-0 items-center gap-2 rounded-[var(--radius)] px-1.5 py-1 hover:bg-[var(--surface-subtle)]',
        draggable ? 'cursor-grab active:cursor-grabbing' : '',
        pending ? 'opacity-50' : '',
      ].join(' ')}
      draggable={draggable}
      onDragEnd={endDrag}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = 'copyMove';
        event.dataTransfer.setData('text/plain', source.displayName);
        startDrag(source);
      }}
    >
      <Avatar displayName={source.displayName} url={photoUrl} fallback="initials" />
      <Link
        className="min-w-0 flex-1 truncate text-sm text-[var(--foreground)] hover:underline"
        draggable={false}
        href={organizationMemberRoute(organizationId, source.membershipId)}
      >
        {source.displayName}
      </Link>
      {roleLabel ? (
        <span className="shrink-0 rounded-full bg-[var(--surface-subtle)] px-2 py-0.5 text-xs font-medium text-[var(--muted)]">
          {roleLabel}
        </span>
      ) : null}
    </li>
  );
}
