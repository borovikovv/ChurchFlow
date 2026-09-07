import type { SubscriptionStatus } from '@churchflow/db';
import { BILLING_GRACE_PERIOD_DAYS } from '@churchflow/shared';
import { addMonths, daysFromNow } from './billing-time';

// LiqPay reports the outcome of a charge in `status`. Anything not listed here - the wait_*
// family, 3DS challenges, and statuses LiqPay may add later - means "not decided yet" and must
// leave the subscription exactly as it was.
const PAID_STATUSES = new Set(['success', 'subscribed', 'sandbox']);
const FAILED_STATUSES = new Set(['failure', 'error', 'reversed']);
const CANCELED_STATUSES = new Set(['unsubscribed']);

/**
 * What a callback says about the charge it reports. Kept separate from the state machine because
 * closing a checkout order needs the same answer: an undecided callback must leave an order open,
 * since the payment it belongs to may still succeed.
 */
export type CallbackOutcome = 'paid' | 'failed' | 'canceled' | 'undecided';

export function classifyCallbackStatus(callbackStatus: string): CallbackOutcome {
  const status = callbackStatus.trim().toLowerCase();

  if (PAID_STATUSES.has(status)) return 'paid';
  if (CANCELED_STATUSES.has(status)) return 'canceled';
  if (FAILED_STATUSES.has(status)) return 'failed';

  return 'undecided';
}

export interface SubscriptionTransitionState {
  status: SubscriptionStatus;
  graceEndsAt: Date | null;
  currentPeriodEndsAt: Date | null;
}

export interface SubscriptionTransitionInput {
  current: SubscriptionTransitionState;
  callbackStatus: string;
  now: Date;
  /**
   * True when the callback belongs to a checkout the organization deliberately started, rather
   * than to the subscription that is already running.
   */
  isNewSubscription: boolean;
}

/**
 * Turns a LiqPay callback status into the subscription's next state, or null when the callback
 * carries no decision. Pure, so the whole state machine is testable without a database.
 *
 * Three rules are easy to get wrong and are the reason this is a function rather than inline
 * branching. A repeated failure must not push the grace deadline further out, otherwise a
 * failing card buys unlimited time. A failure arriving after the organization is already
 * RESTRICTED must not walk it back to PAST_DUE, which would hand back write access. And a
 * charge landing on a subscription the organization has cancelled must not revive it - only a
 * checkout it started itself may bring a cancelled subscription back.
 */
export function transitionForCallbackStatus(
  input: SubscriptionTransitionInput,
): SubscriptionTransitionState | null {
  const { current, callbackStatus, now, isNewSubscription } = input;
  const outcome = classifyCallbackStatus(callbackStatus);

  if (outcome === 'paid') {
    if (current.status === 'CANCELED' && !isNewSubscription) {
      return null;
    }

    return {
      status: 'ACTIVE',
      graceEndsAt: null,
      currentPeriodEndsAt: addMonths(now, 1),
    };
  }

  // A checkout that did not succeed must not disturb the subscription that is still running.
  // The live one keeps its own state until its own charges say otherwise.
  if (isNewSubscription) {
    return null;
  }

  if (outcome === 'canceled') {
    return {
      status: 'CANCELED',
      graceEndsAt: null,
      currentPeriodEndsAt: current.currentPeriodEndsAt,
    };
  }

  if (outcome === 'failed') {
    if (current.status === 'RESTRICTED' || current.status === 'CANCELED') {
      return null;
    }

    return {
      status: 'PAST_DUE',
      graceEndsAt:
        current.status === 'PAST_DUE' && current.graceEndsAt
          ? current.graceEndsAt
          : daysFromNow(now, BILLING_GRACE_PERIOD_DAYS),
      currentPeriodEndsAt: current.currentPeriodEndsAt,
    };
  }

  return null;
}
