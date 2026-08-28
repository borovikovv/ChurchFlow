'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'react-toastify';
import { Button } from '@/components/ui/button';
import { requestEmailVerification } from '../actions';

export function EmailVerificationNotice({
  email,
  emailVerified,
}: {
  email: string | null;
  emailVerified: string | null;
}) {
  const t = useTranslations('profile');
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  if (!email) {
    return null;
  }

  if (emailVerified) {
    return <p className="text-sm text-[var(--success)]">{t('emailVerified')}</p>;
  }

  async function handleVerify(): Promise<void> {
    setPending(true);
    try {
      const result = await requestEmailVerification();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      setSent(true);
      toast.success(t('verificationSent'));
    } catch {
      toast.error(t('verificationFailed'));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="stack gap-2">
      <p className="text-sm opacity-70">{sent ? t('verificationSent') : t('emailNotVerified')}</p>
      {sent ? null : (
        <div>
          <Button
            disabled={pending}
            onClick={() => void handleVerify()}
            type="button"
            variant="secondary"
          >
            {pending ? t('verificationSending') : t('verifyEmail')}
          </Button>
        </div>
      )}
    </div>
  );
}
