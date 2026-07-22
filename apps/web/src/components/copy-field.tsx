'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

export function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const t = useTranslations('common');

  async function copy(): Promise<void> {
    await navigator.clipboard.writeText(value);
    setCopied(true);
  }

  return (
    <div className="actions inline">
      <input aria-label={t('copyLink')} readOnly value={value} />
      <button className="button secondary" type="button" onClick={copy}>
        {copied ? t('copied') : t('copyLink')}
      </button>
    </div>
  );
}
