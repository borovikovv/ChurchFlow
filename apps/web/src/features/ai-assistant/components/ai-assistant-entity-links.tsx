'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { AiAssistantEntityLink } from '@churchflow/shared';
import { ChevronRightIcon } from '@/components/icons/action-icons';
import { aiAssistantEntityLinkRoute } from '../lib/entity-links';

export function AiAssistantEntityLinks({
  links,
  organizationId,
  onNavigate,
}: {
  links: AiAssistantEntityLink[];
  organizationId: string;
  onNavigate: () => void;
}) {
  const t = useTranslations('aiAssistant');

  return (
    <ul aria-label={t('linksLabel')} className="m-0 flex list-none flex-wrap gap-1.5 p-0">
      {links.map((link) => (
        <li key={`${link.kind}:${link.id ?? link.label}`}>
          <Link
            className="inline-flex max-w-full items-center gap-1 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-xs font-semibold text-[var(--accent)] hover:bg-[var(--surface-subtle)] hover:no-underline"
            href={aiAssistantEntityLinkRoute(organizationId, link)}
            onClick={onNavigate}
          >
            <span className="truncate">{link.label}</span>
            <ChevronRightIcon className="h-3.5 w-3.5" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
