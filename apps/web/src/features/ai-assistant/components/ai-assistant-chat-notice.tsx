'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { formatIsoDate } from '@/lib/format-date';
import type { AiAssistantChatNotice as Notice } from './ai-assistant-chat.types';
import { aiAssistantNoticeClassName } from './ai-assistant-notice.styles';

export function AiAssistantChatNotice({
  notice,
  onRefresh,
  onRetry,
}: {
  notice: Notice;
  onRefresh: () => void;
  onRetry: () => void;
}) {
  const t = useTranslations('aiAssistant');

  switch (notice.kind) {
    case 'exhausted':
      return (
        <p className={aiAssistantNoticeClassName({ tone: 'warning' })} role="status">
          {t('usage.exhausted', { date: formatIsoDate(notice.periodEndsAt) })}
        </p>
      );
    case 'unavailable':
      return (
        <p className={aiAssistantNoticeClassName({ tone: 'muted' })} role="status">
          {t('errors.unavailable')}
        </p>
      );
    case 'duplicate':
      return (
        <div className={aiAssistantNoticeClassName({ tone: 'muted' })} role="alert">
          <p className="m-0">{t('errors.duplicate')}</p>
          <Button
            className="justify-self-start"
            type="button"
            variant="secondary"
            onClick={onRefresh}
          >
            {t('refresh')}
          </Button>
        </div>
      );
    case 'confirmationLimit':
      return (
        <p className={aiAssistantNoticeClassName({ tone: 'muted' })} role="status">
          {t('errors.confirmationLimit')}
        </p>
      );
    case 'generic':
      return (
        <div className={aiAssistantNoticeClassName({ tone: 'danger' })} role="alert">
          <p className="m-0">{t('errors.generic')}</p>
          <Button
            className="justify-self-start"
            type="button"
            variant="secondary"
            onClick={onRetry}
          >
            {t('retry')}
          </Button>
        </div>
      );
  }
}
