'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Route } from 'next';
import { useTranslations } from 'next-intl';
import type { SubscriptionStatus } from '@churchflow/shared';
import { BILLING_SECTION_ID, highlightBillingSection } from './billing-highlight';

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
  const pathname = usePathname();
  const homePath = `/dashboard/${organizationId}`;

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
          href={`${homePath}#${BILLING_SECTION_ID}` as Route}
          onClick={(event) => {
            // Already on the home page: scroll there without touching the URL. Elsewhere the
            // link navigates home and the billing section picks up the hash on mount.
            if (pathname === homePath && highlightBillingSection()) {
              event.preventDefault();
            }
          }}
        >
          {t('billing.restrictedAction')}
        </Link>
      ) : null}
    </div>
  );
}
