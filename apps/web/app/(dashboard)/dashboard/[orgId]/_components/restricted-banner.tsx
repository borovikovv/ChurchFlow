'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useTranslations } from 'next-intl';
import type { SubscriptionStatus } from '@churchflow/shared';

interface RestrictedBannerProps {
  organizationId: string;
  status: SubscriptionStatus | null;
  canManageBilling: boolean;
}

/**
 * Shown on every dashboard page of a restricted organization rather than per feature, so the
 * reason is visible wherever the member happens to be when an action stops working.
 */
export function RestrictedBanner({
  organizationId,
  status,
  canManageBilling,
}: RestrictedBannerProps) {
  const t = useTranslations('home');

  return (
    <div className="restricted-banner" role="status">
      <div className="grid gap-1">
        <strong>{t('billing.restrictedTitle')}</strong>
        <span>
          {status === 'PAST_DUE' ? t('billing.restrictedPastDue') : t('billing.restrictedBody')}
        </span>
      </div>
      {canManageBilling ? (
        <Link
          className="ui-button ui-button-primary"
          href={`/dashboard/${organizationId}` as Route}
        >
          {t('billing.restrictedAction')}
        </Link>
      ) : null}
    </div>
  );
}
