'use client';

import { useTranslations } from 'next-intl';
import type { AiAssistantUsageDisplay } from '../types/ai-assistant-view';
import { aiAssistantUsageTextClassName } from './ai-assistant-notice.styles';

/** The exhausted state is announced beside the composer it disables, not here. */
export function AiAssistantQuotaIndicator({ display }: { display: AiAssistantUsageDisplay }) {
  const t = useTranslations('aiAssistant.usage');

  switch (display.kind) {
    case 'counter':
      return (
        <p className={aiAssistantUsageTextClassName({ tone: 'muted' })}>
          {t('counter', { used: display.used, limit: display.limit })}
        </p>
      );
    case 'warning':
      return (
        <p className={aiAssistantUsageTextClassName({ tone: 'warning' })}>
          {t('warning', { remaining: display.remaining })}
        </p>
      );
    default:
      return null;
  }
}
