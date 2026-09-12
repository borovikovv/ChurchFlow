import type { SubscriptionStatus } from '@churchflow/db';
import { BILLING_GRACE_PERIOD_DAYS } from '@churchflow/shared';
import { addMonths, daysFromNow } from './billing-time';

// LiqPay reports the outcome of a charge in `status`. Anything not listed here - the wait_*
// family, 3DS challenges, and statuses LiqPay may add later - means "not decided yet" and must
// leave the subscription exactly as it was.
const PAID_STATUSES = new Set(['success', 'subscribed', 'sandbox']);
const FAILED_STATUS_LIST = ['failure', 'error', 'reversed'] as const;
const FAILED_STATUSES = new Set<string>(FAILED_STATUS_LIST);
const CANCELED_STATUSES = new Set(['unsubscribed']);

/**
 * Exported for the callback log query behind `isOutOfOrderCallback`: once one of these is on
 * record for a payment, a `success` for the same payment arriving afterwards is a late delivery
 * of an outcome that has already been superseded, not a new one.
 */
export const FAILED_CALLBACK_STATUSES: readonly string[] = FAILED_STATUS_LIST;

/**
 * What a callback says about the charge it reports. Kept separate from the state machine because
 * closing a checkout order needs the same answer: an undecided callback must leave an order open,
 * since the payment it belongs to may still succeed.
 */
export type CallbackOutcome = 'paid' | 'failed' | 'canceled' | 'undecided';

function normalizeStatus(callbackStatus: string): string {
  return callbackStatus.trim().toLowerCase();
}

/** A settled charge taken back, as opposed to one that never went through. */
function isChargeback(callbackStatus: string): boolean {
  return normalizeStatus(callbackStatus) === 'reversed';
}

export function classifyCallbackStatus(callbackStatus: string): CallbackOutcome {
  const status = normalizeStatus(callbackStatus);

  if (PAID_STATUSES.has(status)) return 'paid';
  if (CANCELED_STATUSES.has(status)) return 'canceled';
  if (FAILED_STATUSES.has(status)) return 'failed';

  return 'undecided';
}

/**
 * What a callback is reporting about, decided from the order it names rather than from the order
 * id alone. A checkout that was abandoned or has already been superseded is not a purchase we may
 * act on, and treating it as one lets a stale LiqPay tab revive a cancelled subscription or push
 * the live one aside.
 */
export type CallbackRole =
  /** A charge against the order the subscription already runs on. */
  | 'renewal'
  /** A checkout still open, so paying for it is a purchase the organization is making now. */
  | 'new-checkout'
  /** An order we will not honour: abandoned, or paid but since replaced by another one. */
  | 'retired-checkout';

export function callbackRole(input: {
  /** Null when the callback belongs to an order LiqPay charges directly, not to a checkout. */
  checkoutStatus: 'PROPOSED' | 'PAID' | 'ABANDONED' | null;
  /** True when the order is the one the subscription currently runs on. */
  isLiveOrder: boolean;
}): CallbackRole {
  if (input.checkoutStatus === null || input.isLiveOrder) {
    // LiqPay reports every monthly charge against the order that created the subscription, so an
    // order that is already live is never a new purchase however it was found.
    return input.checkoutStatus === 'ABANDONED' ? 'retired-checkout' : 'renewal';
  }

  return input.checkoutStatus === 'PROPOSED' ? 'new-checkout' : 'retired-checkout';
}

export interface SubscriptionTransitionState {
  status: SubscriptionStatus;
  graceEndsAt: Date | null;
  currentPeriodEndsAt: Date | null;
  cancelRequestedAt: Date | null;
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

/** Stop renewals without shortening paid access or restarting an existing grace period. */
export function cancellationTransition(
  current: SubscriptionTransitionState,
  now: Date,
): SubscriptionTransitionState {
  if (current.cancelRequestedAt)
    return {
      status: current.status,
      graceEndsAt: current.graceEndsAt,
      currentPeriodEndsAt: current.currentPeriodEndsAt,
      cancelRequestedAt: current.cancelRequestedAt,
    };
  const graceEndsAt =
    current.status === 'ACTIVE' && current.currentPeriodEndsAt
      ? daysFromNow(current.currentPeriodEndsAt, BILLING_GRACE_PERIOD_DAYS)
      : current.status === 'PAST_DUE'
        ? current.graceEndsAt
        : null;
  // A deadline already behind us grants nothing. Carrying it forward is how cancelling an overdue
  // subscription announces that access "continues until" a date that has already passed.
  const remaining = graceEndsAt && graceEndsAt > now ? graceEndsAt : null;

  return {
    status: remaining ? current.status : 'CANCELED',
    currentPeriodEndsAt: current.currentPeriodEndsAt,
    graceEndsAt: remaining,
    cancelRequestedAt: now,
  };
}

/**
 * A payment taken back after cancellation. Access was granted for money the organization no longer
 * holds, so the deadline is pulled in to the ordinary grace period while the cancellation itself
 * stands. A deadline that is already sooner than that is left alone, so a second reversal on the
 * same period neither extends access nor repeats the notice.
 */
function chargebackTransition(
  current: SubscriptionTransitionState,
  now: Date,
): SubscriptionTransitionState | null {
  const graceEndsAt = daysFromNow(now, BILLING_GRACE_PERIOD_DAYS);
  if (!current.graceEndsAt || current.graceEndsAt <= graceEndsAt) return null;

  return {
    status: current.status,
    currentPeriodEndsAt: current.currentPeriodEndsAt,
    graceEndsAt,
    cancelRequestedAt: current.cancelRequestedAt,
  };
}

/**
 * Turns a LiqPay callback status into the subscription's next state, or null when the callback
 * carries no decision. Pure, so the whole state machine is testable without a database.
 *
 * Three rules are easy to get wrong and are the reason this is a function rather than inline
 * branching. A repeated failure must not push the grace deadline further out, otherwise a
 * failing card buys unlimited time. A failure arriving after the organization is already
 * RESTRICTED must not walk it back to PAST_DUE, which would hand back write access. And a
 * paid charge after cancellation credits access while preserving the cancellation intent.
 * Only a checkout started by the organization can restore automatic renewal. And a charge that
 * lands while the current period is still running extends it rather than restarting it.
 *
 * What this cannot see is delivery order, which `isOutOfOrderCallback` decides separately: every
 * rule here reads the subscription as it stands now and assumes the callback is the newest thing
 * to have happened to it.
 */
export function transitionForCallbackStatus(
  input: SubscriptionTransitionInput,
): SubscriptionTransitionState | null {
  const { current, callbackStatus, now, isNewSubscription } = input;
  const outcome = classifyCallbackStatus(callbackStatus);

  // A charge reversed after cancellation takes back access that was paid for, so the deadline is
  // pulled in rather than left standing. Everything else a cancelled subscription can report is
  // noise it must not act on: a declined renewal is the cancellation working, and the failed
  // branch below would clear the cancellation and restart renewal reconciliation on top of it.
  if (!isNewSubscription && current.cancelRequestedAt && outcome !== 'paid') {
    return isChargeback(callbackStatus) ? chargebackTransition(current, now) : null;
  }

  if (outcome === 'paid') {
    // Time already paid for is never forfeited because a charge landed before it ran out. The
    // month is added to what is left rather than replacing it, which is what makes replacing a
    // card - a fresh checkout against a subscription still inside its paid period - cost a month
    // rather than a month plus whatever was left of the old one.
    const periodStart =
      current.currentPeriodEndsAt && current.currentPeriodEndsAt > now
        ? current.currentPeriodEndsAt
        : now;
    const currentPeriodEndsAt = addMonths(periodStart, 1);

    if (!isNewSubscription && (current.cancelRequestedAt || current.status === 'CANCELED')) {
      return {
        status: 'ACTIVE',
        currentPeriodEndsAt,
        graceEndsAt: daysFromNow(currentPeriodEndsAt, BILLING_GRACE_PERIOD_DAYS),
        cancelRequestedAt: current.cancelRequestedAt ?? now,
      };
    }

    return {
      status: 'ACTIVE',
      graceEndsAt: null,
      currentPeriodEndsAt,
      cancelRequestedAt: null,
    };
  }

  // A checkout that did not succeed must not disturb the subscription that is still running.
  // The live one keeps its own state until its own charges say otherwise.
  if (isNewSubscription) {
    return null;
  }

  if (outcome === 'canceled') {
    // Cancelled before this branch recorded a timestamp for it, and the nightly unsubscribe retry
    // still draws an `unsubscribed` out of LiqPay for such a row. Recording one now would restate
    // a months-old cancellation as today's, reopening a grace period that has long since closed.
    if (current.status === 'CANCELED') {
      return null;
    }

    return cancellationTransition(current, now);
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
      cancelRequestedAt: null,
    };
  }

  return null;
}

/**
 * Whether a callback is describing something that has already been overtaken. LiqPay retries
 * deliveries and does not promise they arrive in the order the events happened, and every rule in
 * `transitionForCallbackStatus` reads the subscription as it stands now - so without this a
 * failure delivered late walks a subscription that has since been paid for back into PAST_DUE,
 * and a `success` redelivered after the same payment was reversed hands the access back.
 *
 * Two independent signals, because either can be missing. The event time orders callbacks against
 * each other; a settled failure for this very payment stands on its own, even for a provider
 * response that carries no timestamp at all.
 */
export function isOutOfOrderCallback(input: {
  outcome: CallbackOutcome;
  /** When the reported event happened, as LiqPay stamped it. Null when it sent no timestamp. */
  eventAt: Date | null;
  /** The newest event time already applied to this subscription. */
  lastEventAt: Date | null;
  /** A failure or reversal is already on record for the same payment. */
  paymentAlreadyFailed: boolean;
}): boolean {
  if (input.outcome === 'paid' && input.paymentAlreadyFailed) {
    return true;
  }

  // Equal stamps are left alone: LiqPay reports a charge and its subscription event at the same
  // instant, and neither of them supersedes the other.
  return Boolean(input.eventAt && input.lastEventAt && input.eventAt < input.lastEventAt);
}

export function canRequestCancellation(subscription: {
  status: SubscriptionStatus;
  liqpayOrderId: string | null;
  cancelRequestedAt: Date | null;
}): boolean {
  return (
    subscription.liqpayOrderId !== null &&
    subscription.status !== 'CANCELED' &&
    !subscription.cancelRequestedAt
  );
}
