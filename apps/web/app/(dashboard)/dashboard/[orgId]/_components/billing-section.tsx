'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { toast } from 'react-toastify';
import type { BillingCheckout, SubscriptionSummary } from '@churchflow/shared';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { cancelSubscriptionAction, startBillingCheckoutAction } from '../actions';

interface BillingSectionProps {
  organizationId: string;
  subscription: SubscriptionSummary | null;
  loadError: string | null;
}

/**
 * LiqPay's hosted checkout only accepts a form POST of the signed `data` and `signature`, so the
 * browser is handed off with a form it submits itself. Nothing about the card passes through
 * this component, or through us at all.
 */
function submitToLiqPay(checkout: BillingCheckout): void {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = checkout.checkoutUrl;
  form.acceptCharset = 'utf-8';

  for (const [name, value] of Object.entries({
    data: checkout.data,
    signature: checkout.signature,
  })) {
    const field = document.createElement('input');
    field.type = 'hidden';
    field.name = name;
    field.value = value;
    form.append(field);
  }

  document.body.append(form);
  form.submit();
}

export function BillingSection({ organizationId, subscription, loadError }: BillingSectionProps) {
  const t = useTranslations('home');
  const locale = useLocale();
  const [pending, startTransition] = useTransition();
  const [current, setCurrent] = useState(subscription);

  const formatDate = (value: string | null): string | null =>
    value ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(value)) : null;

  const formatAmount = (): string | null => {
    if (current?.amountMinor == null || !current.currency) return null;

    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: current.currency,
    }).format(current.amountMinor / 100);
  };

  const handleCheckout = () => {
    startTransition(async () => {
      const result = await startBillingCheckoutAction({ organizationId });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      submitToLiqPay(result.checkout);
    });
  };

  const handleCancel = () => {
    startTransition(async () => {
      const result = await cancelSubscriptionAction({ organizationId });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      setCurrent(result.subscription);
      toast.success(t('billing.canceled'));
    });
  };

  if (loadError) {
    return (
      <section className="grid gap-4">
        <h2 className="m-0 text-xl">{t('billing.title')}</h2>
        <p className="form-error m-0">{loadError}</p>
      </section>
    );
  }

  if (!current) {
    return null;
  }

  const amount = formatAmount();
  const nextChargeAt = formatDate(current.currentPeriodEndsAt);
  const graceEndsAt = formatDate(current.graceEndsAt);
  const restrictAfter = formatDate(current.restrictAfter);
  const hasSubscription = current.status === 'ACTIVE' || current.status === 'PAST_DUE';

  return (
    <section className="grid gap-4">
      <div className="grid gap-1">
        <h2 className="m-0 text-xl">{t('billing.title')}</h2>
        <p className="m-0 text-[var(--muted)]">{t('billing.description')}</p>
      </div>

      <dl className="details">
        <dt>{t('billing.status')}</dt>
        <dd>
          <StatusBadge label={t(`billing.statuses.${current.status}`)} status={current.status} />
        </dd>

        {current.isExempt ? (
          <>
            <dt>{t('billing.complimentary')}</dt>
            <dd>{current.exemptReason ?? t('billing.complimentaryGranted')}</dd>
          </>
        ) : null}

        {amount ? (
          <>
            <dt>{t('billing.amount')}</dt>
            <dd>{t('billing.perMonth', { amount })}</dd>
          </>
        ) : null}

        {nextChargeAt ? (
          <>
            <dt>{t('billing.nextCharge')}</dt>
            <dd>{nextChargeAt}</dd>
          </>
        ) : null}

        {graceEndsAt && current.status === 'PAST_DUE' ? (
          <>
            <dt>{t('billing.graceEnds')}</dt>
            <dd>{graceEndsAt}</dd>
          </>
        ) : null}

        {restrictAfter && current.status === 'PENDING' ? (
          <>
            <dt>{t('billing.windowEnds')}</dt>
            <dd>{restrictAfter}</dd>
          </>
        ) : null}

        <dt>{t('billing.card')}</dt>
        <dd>
          {current.card?.mask
            ? [current.card.brand, current.card.mask].filter(Boolean).join(' ')
            : t('billing.noCard')}
        </dd>
      </dl>

      {current.isExempt ? (
        <p className="m-0 text-[var(--muted)]">{t('billing.complimentaryNotice')}</p>
      ) : (
        <div className="actions">
          <Button disabled={pending} onClick={handleCheckout} type="button">
            {hasSubscription ? t('billing.replaceCard') : t('billing.subscribe')}
          </Button>
          {hasSubscription ? (
            <Button disabled={pending} onClick={handleCancel} type="button" variant="danger">
              {t('billing.cancel')}
            </Button>
          ) : null}
        </div>
      )}
    </section>
  );
}
