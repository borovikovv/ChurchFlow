import type { SubscriptionStatus } from '@churchflow/shared';
import { addMonths, BILLING_TIME_ZONE } from '../billing/billing-time';
import {
  zonedDateParts,
  zonedDateTimeToUtc,
} from '../calendar-events/recurrence/calendar-recurrence';

export interface AiAssistantSubscriptionState {
  status: SubscriptionStatus;
  isExempt: boolean;
  currentPeriodEndsAt: Date | null;
}

export interface AiAssistantUsagePeriod {
  start: Date;
  end: Date;
}

export type AiAssistantAccessDecision =
  | { allowed: true; period: AiAssistantUsagePeriod }
  | { allowed: false };

/**
 * Who may use the assistant, and which window their allowance is counted in. Stricter than the
 * entitlements on purpose: a grace period keeps an organization writable, but it does not keep
 * paying for model calls. Pure so every branch is testable without a clock or a database.
 */
export function resolveAiAssistantAccess(input: {
  subscription: AiAssistantSubscriptionState | null;
  enforcementEnabled: boolean;
  now: Date;
}): AiAssistantAccessDecision {
  const { subscription, enforcementEnabled, now } = input;

  // Billing switched off means nobody is restricted anywhere, which includes this feature.
  if (!enforcementEnabled || subscription?.isExempt) {
    return { allowed: true, period: calendarMonthPeriod(now) };
  }

  if (!subscription || subscription.status !== 'ACTIVE') {
    return { allowed: false };
  }

  return {
    allowed: true,
    period: subscription.currentPeriodEndsAt
      ? billingPeriodContaining(subscription.currentPeriodEndsAt, now)
      : calendarMonthPeriod(now),
  };
}

/**
 * The paid month that contains `now`, anchored on the period end LiqPay reported. A late renewal
 * callback leaves that end in the past for a while; stepping forward keeps counting in a window
 * that actually contains the request instead of one that has already closed.
 */
export function billingPeriodContaining(periodEndsAt: Date, now: Date): AiAssistantUsagePeriod {
  let end = periodEndsAt;
  let start = addMonths(end, -1);

  while (now.getTime() >= end.getTime()) {
    start = end;
    end = addMonths(end, 1);
  }

  while (now.getTime() < start.getTime()) {
    end = start;
    start = addMonths(start, -1);
  }

  return { start, end };
}

export function calendarMonthPeriod(now: Date): AiAssistantUsagePeriod {
  const { year, month } = zonedDateParts(now, BILLING_TIME_ZONE);
  const start = zonedDateTimeToUtc(
    { year, month, day: 1, hour: 0, minute: 0, second: 0 },
    BILLING_TIME_ZONE,
  );
  const nextMonth = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
  const end = zonedDateTimeToUtc(
    { ...nextMonth, day: 1, hour: 0, minute: 0, second: 0 },
    BILLING_TIME_ZONE,
  );

  return { start, end };
}

/**
 * The period a platform admin sees by default. Unlike the allowance it exists for every
 * organization - one that may not use the assistant today may well have used it last month.
 */
export function reportingPeriod(input: {
  subscription: AiAssistantSubscriptionState | null;
  enforcementEnabled: boolean;
  now: Date;
}): AiAssistantUsagePeriod {
  const decision = resolveAiAssistantAccess(input);
  if (decision.allowed) return decision.period;

  return input.subscription?.currentPeriodEndsAt
    ? billingPeriodContaining(input.subscription.currentPeriodEndsAt, input.now)
    : calendarMonthPeriod(input.now);
}
