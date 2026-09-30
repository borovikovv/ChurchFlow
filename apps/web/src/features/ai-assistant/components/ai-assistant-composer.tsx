'use client';

import { useTranslations } from 'next-intl';
import { useId, useState, type KeyboardEvent } from 'react';
import { AI_ASSISTANT_MESSAGE_MAX_LENGTH } from '@churchflow/shared';
import { Button } from '@/components/ui/button';

export function AiAssistantComposer({
  busy,
  disabled,
  onSend,
  onStop,
}: {
  busy: boolean;
  disabled: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
}) {
  const t = useTranslations('aiAssistant');
  const hintId = useId();
  const [text, setText] = useState('');
  const canSend = !busy && !disabled && text.trim().length > 0;

  function submit() {
    if (!canSend) return;
    onSend(text.trim());
    setText('');
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    submit();
  }

  return (
    <form
      className="grid gap-1.5 border-t border-[var(--line)] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div className="flex items-end gap-2">
        <textarea
          aria-describedby={hintId}
          aria-label={t('composerLabel')}
          className="field-sizing-content max-h-40 min-h-10 flex-1 resize-none rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-base text-[var(--foreground)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--accent)] disabled:cursor-not-allowed disabled:bg-[var(--surface-subtle)] md:text-sm"
          disabled={disabled}
          maxLength={AI_ASSISTANT_MESSAGE_MAX_LENGTH}
          placeholder={t('composerPlaceholder')}
          rows={1}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={handleKeyDown}
        />
        {busy ? (
          <Button className="min-h-10" type="button" variant="secondary" onClick={onStop}>
            {t('stop')}
          </Button>
        ) : (
          <Button className="min-h-10" disabled={!canSend} type="submit">
            {t('send')}
          </Button>
        )}
      </div>
      <p className="m-0 text-xs text-[var(--muted)] max-md:hidden" id={hintId}>
        {t('composerHint')}
      </p>
    </form>
  );
}
