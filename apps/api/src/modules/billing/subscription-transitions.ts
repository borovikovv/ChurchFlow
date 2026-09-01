import type { SubscriptionStatus } from '@churchflow/db';
import { BILLING_GRACE_PERIOD_DAYS } from '@churchflow/shared';

const DAY_MS = 24 * 60 * 60 * 1000;

// LiqPay reports the outcome of a charge in `status`. Anything not listed here - the wait_*
// family, 3DS challenges, and statuses LiqPay may add later - means "not decided yet" and must
// leave the subscription exactly as it was.
const PAID_STATUSES = new Set(['success', 'subscribed', 'sandbox']);
const FAILED_STATUSES = new Set(['failure', 'error', 'reversed']);
const CANCELED_STATUSES = new Set(['unsubscribed']);

export interface SubscriptionTransitionState {
  status: SubscriptionStatus;
  graceEndsAt: Date | null;
  currentPeriodEndsAt: Date | null;
}

export function addMonths(from: Date, months: number): Date {
  const next = new Date(from.getTime());
  next.setUTCMonth(next.getUTCMonth() + months);

  return next;
}

/**
 * Turns a LiqPay callback status into the subscription's next state, or null when the callback
 * carries no decision. Pure, so the whole state machine is testable without a database.
 *
 * Two rules are easy to get wrong and are the reason this is a function rather than inline
 * branching. A repeated failure must not push the grace deadline further out, otherwise a
 * failing card buys unlimited time. And a failure arriving after the organization is already
 * RESTRICTED must not walk it back to PAST_DUE, which would hand back write access.
 */
export function transitionForCallbackStatus(input: {
  current: SubscriptionTransitionState;
  callbackStatus: string;
  now: Date;
}): SubscriptionTransitionState | null {
  const { current, callbackStatus, now } = input;
  const status = callbackStatus.trim().toLowerCase();

  if (PAID_STATUSES.has(status)) {
    return {
      status: 'ACTIVE',
      graceEndsAt: null,
      currentPeriodEndsAt: addMonths(now, 1),
    };
  }

  if (CANCELED_STATUSES.has(status)) {
    return {
      status: 'CANCELED',
      graceEndsAt: null,
      currentPeriodEndsAt: current.currentPeriodEndsAt,
    };
  }

  if (FAILED_STATUSES.has(status)) {
    if (current.status === 'RESTRICTED') {
      return null;
    }

    return {
      status: 'PAST_DUE',
      graceEndsAt:
        current.status === 'PAST_DUE' && current.graceEndsAt
          ? current.graceEndsAt
          : new Date(now.getTime() + BILLING_GRACE_PERIOD_DAYS * DAY_MS),
      currentPeriodEndsAt: current.currentPeriodEndsAt,
    };
  }

  return null;
}
