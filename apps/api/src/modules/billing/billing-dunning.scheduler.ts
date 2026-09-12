import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  BILLING_GRACE_PERIOD_DAYS,
  BILLING_RECONCILIATION_GRACE_DAYS,
  BILLING_ROLLOUT_WINDOW_STALE_DAYS,
  BILLING_TRANSITION_WINDOW_DAYS,
} from '@churchflow/shared';
import { ScheduledJobLockService } from '../scheduled-jobs/scheduled-job-lock.service';
import { BILLING_TIME_ZONE, dayKey, daysFromNow } from './billing-time';
import { BillingService } from './billing.service';
import { EntitlementsService } from './entitlements.service';
import { SubscriptionsRepository } from './repositories/subscriptions.repository';

const BILLING_DUNNING_JOB = 'billing.dunning';
const BILLING_DUNNING_LOCK_TTL_MS = 10 * 60 * 1000;
const FINAL_WARNING_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface BillingDunningResult {
  reopenedCount: number;
  reconciledCount: number;
  restrictedCount: number;
  warnedCount: number;
  stoppedCount: number;
}

/**
 * Finalizes expired cancellations as CANCELED and other overdue subscriptions as RESTRICTED, and
 * warns organizations still inside their rollout window.
 *
 * It deliberately does not retry charges. LiqPay owns the recurring schedule once a subscription
 * exists and reports each attempt through the callback, so retrying here would double-charge.
 */
@Injectable()
export class BillingDunningScheduler {
  private readonly logger = new Logger(BillingDunningScheduler.name);

  constructor(
    private readonly subscriptionsRepository: SubscriptionsRepository,
    private readonly billingService: BillingService,
    private readonly scheduledJobLockService: ScheduledJobLockService,
    private readonly entitlementsService: EntitlementsService,
  ) {}

  @Cron('0 20 3 * * *', {
    name: BILLING_DUNNING_JOB,
    timeZone: BILLING_TIME_ZONE,
    waitForCompletion: true,
  })
  async handleDunning(): Promise<void> {
    const execution = await this.scheduledJobLockService.runOnce(
      BILLING_DUNNING_JOB,
      () => this.run(new Date()),
      { lockTtlMs: BILLING_DUNNING_LOCK_TTL_MS },
    );

    if (execution.skipped) {
      return;
    }

    this.logger.log({ event: 'Billing dunning completed', ...execution.result });
  }

  async run(now: Date): Promise<BillingDunningResult> {
    // The kill switch covers the whole of billing, not only entitlement resolution. With
    // enforcement off nothing is restricted, so restricting rows and telling churches their
    // access is about to end would describe a state that does not exist - and the rollout
    // migration starts every window at deploy time, before anyone has enabled enforcement.
    //
    // Stopping a charge is the exception: an order LiqPay is still billing keeps taking money
    // from a card whether or not we are enforcing anything, so those retries always run.
    if (!this.entitlementsService.isEnforcementEnabled()) {
      return {
        reopenedCount: 0,
        reconciledCount: 0,
        restrictedCount: 0,
        warnedCount: 0,
        stoppedCount: await this.retryPendingUnsubscribes(),
      };
    }

    // Reopening runs before restriction so a window that expired unenforced is handed back in
    // the same pass rather than spent on the way through. Reconciliation runs before restriction
    // too, so an unconfirmed renewal enters its grace period without waiting a further day.
    return {
      reopenedCount: await this.reopenStaleTransitionWindows(now),
      reconciledCount: await this.reconcileUnconfirmedRenewals(now),
      restrictedCount: await this.restrictExpired(now),
      warnedCount: await this.warnOpenTransitionWindows(now),
      stoppedCount: await this.retryPendingUnsubscribes(),
    };
  }

  /**
   * A rollout window is only meaningful while something enforces it. One that ran out with
   * billing switched off, or with the API not running, warned nobody and restricted nobody, so
   * it is handed back instead of being spent: otherwise the day enforcement is turned on, every
   * church that existed at migration time loses write access in the first nightly pass.
   *
   * The job runs nightly, so a window under enforcement is never more than a day past its
   * deadline. Anything staler than that did not have a job watching it.
   */
  private async reopenStaleTransitionWindows(now: Date): Promise<number> {
    const { count } = await this.subscriptionsRepository.reopenStaleTransitionWindows({
      staleBefore: daysFromNow(now, -BILLING_ROLLOUT_WINDOW_STALE_DAYS),
      restrictAfter: daysFromNow(now, BILLING_TRANSITION_WINDOW_DAYS),
    });

    if (count > 0) {
      this.logger.log({ event: 'Rollout windows reopened after an unenforced period', count });
    }

    return count;
  }

  /**
   * Nothing else in the system notices a callback that never arrived. Without this an organization
   * whose renewal went undelivered keeps full access forever, because the only thing that ever
   * moves a subscription off ACTIVE is a callback.
   *
   * The organization is moved to PAST_DUE rather than straight to RESTRICTED: from here the
   * payment is unconfirmed, not known to have failed, and it still gets its full grace period.
   *
   * Unconfirmed is the operative word, and LiqPay is asked before it is treated as unpaid. A
   * charge that went through and whose callback was lost is settled from the answer, which moves
   * the paid period past the cutoff and leaves the guarded write below with nothing to change -
   * the same path a callback arriving mid-pass already takes.
   */
  private async reconcileUnconfirmedRenewals(now: Date): Promise<number> {
    const cutoff = daysFromNow(now, -BILLING_RECONCILIATION_GRACE_DAYS);
    const unconfirmed = await this.subscriptionsRepository.listUnconfirmedRenewals(cutoff);
    const graceEndsAt = daysFromNow(now, BILLING_GRACE_PERIOD_DAYS);
    let reconciled = 0;

    for (const subscription of unconfirmed) {
      if (subscription.liqpayOrderId) {
        await this.billingService.reconcileOrderWithProvider(subscription.liqpayOrderId, now);
      }

      const { count } = await this.subscriptionsRepository.markPastDueIfStillUnconfirmed({
        subscriptionId: subscription.id,
        cutoff,
        graceEndsAt,
      });

      // The renewal arrived while this pass was running, or LiqPay has just confirmed it above.
      // There is nothing left to reconcile, and telling an organization that has just paid that
      // its payment failed would be worse than saying nothing at all.
      if (count === 0) {
        continue;
      }

      reconciled += 1;
      await this.billingService.notifyOrganizationAdmins({
        organizationId: subscription.organizationId,
        type: 'SUBSCRIPTION_PAYMENT_FAILED',
        titleKey: 'subscriptionPaymentFailed',
        bodyMessage: {
          key: 'subscriptionDeadline',
          deadline: graceEndsAt.toISOString(),
          timeZone: BILLING_TIME_ZONE,
        },
        dedupeKey: `payment-failed:${dayKey(graceEndsAt)}`,
        recipientMembershipIds: subscription.organization.members.map((member) => member.id),
      });
    }

    return reconciled;
  }

  /**
   * A cancellation LiqPay has not acknowledged yet. Retried until it does, because the
   * alternative is a card that keeps being charged behind a subscription shown as cancelled.
   */
  private async retryPendingUnsubscribes(): Promise<number> {
    const pending = await this.subscriptionsRepository.listOpenUnsubscribeRequests();
    let stopped = 0;

    for (const request of pending) {
      if (await this.billingService.stopOrder(request.orderId)) {
        stopped += 1;
      }
    }

    return stopped;
  }

  private async restrictExpired(now: Date): Promise<number> {
    const due = await this.subscriptionsRepository.listRestrictionDue(now);
    let restricted = 0;

    for (const subscription of due) {
      const { count } = await this.subscriptionsRepository.restrictIfStillDue(subscription.id, now);

      // A payment landed between the batch being read and this row being written. It is no longer
      // due, and restricting it would take write access from an organization that just paid.
      if (count === 0) {
        continue;
      }

      restricted += 1;
      // An organization that asked to stop is told its cancellation has taken effect; one that
      // simply ran out of paid access is told it is now read-only.
      const notice = subscription.cancelRequestedAt
        ? ({ type: 'SUBSCRIPTION_CANCELED', key: 'subscriptionCancellationEnded' } as const)
        : ({ type: 'SUBSCRIPTION_RESTRICTED', key: 'subscriptionRestricted' } as const);

      await this.billingService.notifyOrganizationAdmins({
        organizationId: subscription.organizationId,
        type: notice.type,
        titleKey: notice.key,
        bodyMessage: { key: notice.key },
        dedupeKey: `restricted:${dayKey(now)}`,
        recipientMembershipIds: subscription.organization.members.map((member) => member.id),
      });
    }

    return restricted;
  }

  /**
   * Two warnings, both deduplicated by key rather than by a flag on the row: one when the job
   * first sees an open window, and one in its last day. A rerun of the job re-sends neither.
   */
  private async warnOpenTransitionWindows(now: Date): Promise<number> {
    const open = await this.subscriptionsRepository.listTransitionWindowOpen(now);
    let warned = 0;

    for (const subscription of open) {
      if (!subscription.restrictAfter) {
        continue;
      }

      const isFinalDay =
        subscription.restrictAfter.getTime() - now.getTime() <= FINAL_WARNING_WINDOW_MS;

      await this.billingService.notifyOrganizationAdmins({
        organizationId: subscription.organizationId,
        type: 'SUBSCRIPTION_REQUIRED',
        titleKey: 'subscriptionRequired',
        bodyMessage: {
          key: 'subscriptionDeadline',
          deadline: subscription.restrictAfter.toISOString(),
          timeZone: BILLING_TIME_ZONE,
        },
        dedupeKey: isFinalDay ? 'transition-window-final' : 'transition-window',
        recipientMembershipIds: subscription.organization.members.map((member) => member.id),
      });

      warned += 1;
    }

    return warned;
  }
}
