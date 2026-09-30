'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState } from 'react';
import { HistoryIcon, PlusIcon } from '@/components/icons/action-icons';
import {
  useAiAssistantConversations,
  useAiAssistantUsage,
  useFetchAiAssistantMessages,
  useRefreshAiAssistantActivity,
} from '../hooks/use-ai-assistant-queries';
import { aiAssistantUsageDisplay } from '../lib/usage-display';
import type { AiAssistantUsageDisplay } from '../types/ai-assistant-view';
import { AiAssistantChat } from './ai-assistant-chat';
import { AiAssistantConversationList } from './ai-assistant-conversation-list';
import {
  AI_ASSISTANT_ICON_BUTTON_CLASS_NAME,
  AI_ASSISTANT_PANEL_CLASS_NAME,
  AI_ASSISTANT_PANEL_LAYOUT_CLASS_NAME,
} from './ai-assistant-panel.styles';
import type { AiAssistantPanelView, AiAssistantSession } from './ai-assistant-panel.types';
import { AiAssistantQuotaIndicator } from './ai-assistant-quota-indicator';

const HIDDEN_USAGE: AiAssistantUsageDisplay = { kind: 'hidden' };

function newSession(): AiAssistantSession {
  return { id: crypto.randomUUID(), initialMessages: [], revision: 0 };
}

export function AiAssistantPanel({
  open,
  organizationId,
  onClose,
}: {
  open: boolean;
  organizationId: string;
  onClose: () => void;
}) {
  const t = useTranslations('aiAssistant');
  const commonT = useTranslations('common');
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [session, setSession] = useState(newSession);
  const [view, setView] = useState<AiAssistantPanelView>('chat');
  const [openingConversationId, setOpeningConversationId] = useState<string | null>(null);
  const [openFailed, setOpenFailed] = useState(false);
  const usage = useAiAssistantUsage(organizationId, open);
  const conversations = useAiAssistantConversations(organizationId, open && view === 'history');
  const fetchMessages = useFetchAiAssistantMessages(organizationId);
  const refreshActivity = useRefreshAiAssistantActivity(organizationId);
  const usageDisplay = usage.data ? aiAssistantUsageDisplay(usage.data) : HIDDEN_USAGE;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  function startNewChat() {
    setSession(newSession());
    setView('chat');
  }

  async function loadConversation(conversationId: string, revision: number) {
    setOpeningConversationId(conversationId);
    setOpenFailed(false);

    try {
      const initialMessages = await fetchMessages(conversationId);
      setSession({ id: conversationId, initialMessages, revision });
      setView('chat');
    } catch {
      setOpenFailed(true);
    } finally {
      setOpeningConversationId(null);
    }
  }

  function selectConversation(conversationId: string) {
    if (conversationId === session.id) {
      setView('chat');
      return;
    }

    void loadConversation(conversationId, 0);
  }

  return (
    <dialog
      aria-labelledby={titleId}
      className={AI_ASSISTANT_PANEL_CLASS_NAME}
      onClick={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}
      onClose={onClose}
      ref={dialogRef}
    >
      <div className={AI_ASSISTANT_PANEL_LAYOUT_CLASS_NAME}>
        <header className="flex items-center gap-2 border-b border-[var(--line)] px-4 py-3">
          <div className="grid min-w-0 flex-1 gap-0.5">
            <h2 className="m-0 truncate text-lg" id={titleId}>
              {t('title')}
            </h2>
            <AiAssistantQuotaIndicator display={usageDisplay} />
          </div>
          <button
            aria-label={view === 'history' ? t('backToChat') : t('history')}
            aria-pressed={view === 'history'}
            className={AI_ASSISTANT_ICON_BUTTON_CLASS_NAME}
            title={view === 'history' ? t('backToChat') : t('history')}
            type="button"
            onClick={() => setView(view === 'history' ? 'chat' : 'history')}
          >
            <HistoryIcon className="h-5 w-5" />
          </button>
          <button
            aria-label={t('newChat')}
            className={AI_ASSISTANT_ICON_BUTTON_CLASS_NAME}
            title={t('newChat')}
            type="button"
            onClick={startNewChat}
          >
            <PlusIcon className="h-5 w-5" />
          </button>
          <button
            aria-label={commonT('close')}
            className={`${AI_ASSISTANT_ICON_BUTTON_CLASS_NAME} text-2xl`}
            type="button"
            onClick={() => dialogRef.current?.close()}
          >
            ×
          </button>
        </header>
        {view === 'history' ? (
          <AiAssistantConversationList
            activeConversationId={session.id}
            conversations={conversations.data}
            failed={conversations.isError}
            loading={conversations.isPending && conversations.fetchStatus === 'fetching'}
            openFailed={openFailed}
            openingConversationId={openingConversationId}
            onRetry={() => void conversations.refetch()}
            onSelect={selectConversation}
          />
        ) : null}
        {/* Hidden rather than unmounted: unmounting useChat aborts a reply still streaming. */}
        <div className={view === 'history' ? 'hidden' : 'contents'}>
          <AiAssistantChat
            key={`${session.id}:${session.revision}`}
            organizationId={organizationId}
            session={session}
            unavailable={usage.errorKind === 'unavailable'}
            usageDisplay={usageDisplay}
            onNavigate={() => dialogRef.current?.close()}
            onRefresh={() => void loadConversation(session.id, session.revision + 1)}
            onResponseSettled={refreshActivity}
          />
        </div>
      </div>
    </dialog>
  );
}
