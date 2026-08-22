'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations('errors');

  return (
    <main className="section">
      <div className="shell stack max-w-xl">
        <h1>{t('title')}</h1>
        <p>{t('description')}</p>
        <div>
          <Button type="button" onClick={reset}>
            {t('retry')}
          </Button>
        </div>
      </div>
    </main>
  );
}
