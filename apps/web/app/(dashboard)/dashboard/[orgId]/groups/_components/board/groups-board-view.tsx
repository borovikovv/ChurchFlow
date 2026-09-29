'use client';

import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';

function GroupsBoardLoading() {
  const t = useTranslations('groups.board');

  return <p className="text-sm text-[var(--muted)]">{t('loading')}</p>;
}

// React Flow measures the DOM to lay nodes out, so the canvas renders in the browser only.
export const GroupsBoardView = dynamic(
  () => import('./groups-board').then((module) => module.GroupsBoard),
  { ssr: false, loading: () => <GroupsBoardLoading /> },
);
