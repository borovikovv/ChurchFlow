'use client';

import { useTranslations } from 'next-intl';
import type { AiAssistantConversationSummary } from '@churchflow/shared';
import { Button } from '@/components/ui/button';
import { formatIsoDate } from '@/lib/format-date';
import { aiAssistantNoticeClassName } from './ai-assistant-notice.styles';

export function AiAssistantConversationList({
  activeConversationId,
  conversations,
  failed,
  loading,
  openingConversationId,
  openFailed,
  onRetry,
  onSelect,
}: {
  activeConversationId: string;
  conversations: AiAssistantConversationSummary[] | undefined;
  failed: boolean;
  loading: boolean;
  openingConversationId: string | null;
  openFailed: boolean;
  onRetry: () => void;
  onSelect: (conversationId: string) => void;
}) {
  const t = useTranslations('aiAssistant');

  return (
    <div className="grid min-h-0 content-start gap-3 overflow-y-auto p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <h3 className="m-0 px-1 text-sm text-[var(--muted)]">{t('history')}</h3>
      {openFailed ? (
        <p className={aiAssistantNoticeClassName({ tone: 'danger' })} role="alert">
          {t('conversationLoadFailed')}
        </p>
      ) : null}
      {loading ? (
        <p className="m-0 px-1 text-sm text-[var(--muted)]">{t('historyLoading')}</p>
      ) : null}
      {failed ? (
        <div className={aiAssistantNoticeClassName({ tone: 'danger' })} role="alert">
          <p className="m-0">{t('historyLoadFailed')}</p>
          <Button
            className="justify-self-start"
            type="button"
            variant="secondary"
            onClick={onRetry}
          >
            {t('retry')}
          </Button>
        </div>
      ) : null}
      {conversations && conversations.length === 0 ? (
        <p className="m-0 px-1 text-sm text-[var(--muted)]">{t('historyEmpty')}</p>
      ) : null}
      {conversations && conversations.length > 0 ? (
        <ul className="m-0 grid list-none gap-1 p-0">
          {conversations.map((conversation) => {
            const active = conversation.id === activeConversationId;
            const opening = conversation.id === openingConversationId;

            return (
              <li key={conversation.id}>
                <button
                  aria-busy={opening}
                  aria-current={active ? 'true' : undefined}
                  className="grid w-full cursor-pointer gap-0.5 rounded-[var(--radius)] border-0 bg-transparent px-2 py-2 text-left text-[var(--foreground)] hover:bg-[var(--surface-subtle)] disabled:cursor-wait aria-[current=true]:bg-[var(--surface-subtle)]"
                  disabled={openingConversationId !== null}
                  type="button"
                  onClick={() => onSelect(conversation.id)}
                >
                  <span className="truncate text-sm font-semibold">
                    {conversation.title || t('untitledConversation')}
                  </span>
                  <span className="text-xs text-[var(--muted)]">
                    {opening ? t('loadingConversation') : formatIsoDate(conversation.updatedAt)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
