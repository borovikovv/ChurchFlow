import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BILLING_GRACE_PERIOD_DAYS, BILLING_RECONCILIATION_GRACE_DAYS } from '@churchflow/shared';
import { ScheduledJobLockService } from '../scheduled-jobs/scheduled-job-lock.service';
import { BILLING_TIME_ZONE, dayKey, daysFromNow } from './billing-time';
import { BillingService } from './billing.service';
import { SubscriptionsRepository } from './repositories/subscriptions.repository';

const BILLING_DUNNING_JOB = 'billing.dunning';
const BILLING_DUNNING_LOCK_TTL_MS = 10 * 60 * 1000;
const FINAL_WARNING_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface BillingDunningResult {
  reconciledCount: number;
  restrictedCount: number;
  warnedCount: number;
  stoppedCount: number;
}

/**
 * Moves subscriptions whose deadline has passed into RESTRICTED, and warns organizations still
 * inside their rollout window.
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
    // Reconciliation runs first so an unconfirmed renewal enters its grace period in the same
    // pass, rather than waiting a further day to be noticed.
    return {
      reconciledCount: await this.reconcileUnconfirmedRenewals(now),
      restrictedCount: await this.restrictExpired(now),
      warnedCount: await this.warnOpenTransitionWindows(now),
      stoppedCount: await this.retryPendingUnsubscribes(),
    };
  }

  /**
   * Nothing else in the system notices a callback that never arrived. Without this an organization
   * whose renewal went undelivered keeps full access forever, because the only thing that ever
   * moves a subscription off ACTIVE is a callback.
   *
   * The organization is moved to PAST_DUE rather than straight to RESTRICTED: from here the
   * payment is unconfirmed, not known to have failed, and it still gets its full grace period.
   */
  private async reconcileUnconfirmedRenewals(now: Date): Promise<number> {
    const cutoff = daysFromNow(now, -BILLING_RECONCILIATION_GRACE_DAYS);
    const unconfirmed = await this.subscriptionsRepository.listUnconfirmedRenewals(cutoff);
    const graceEndsAt = daysFromNow(now, BILLING_GRACE_PERIOD_DAYS);

    for (const subscription of unconfirmed) {
      await this.subscriptionsRepository.markPastDue(subscription.id, graceEndsAt);
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

    return unconfirmed.length;
  }

  /**
   * A cancellation LiqPay has not acknowledged yet. Retried until it does, because the
   * alternative is a card that keeps being charged behind a subscription shown as cancelled.
   */
  private async retryPendingUnsubscribes(): Promise<number> {
    const pending = await this.subscriptionsRepository.listPendingUnsubscribes();
    let stopped = 0;

    for (const subscription of pending) {
      if (!subscription.pendingUnsubscribeOrderId) {
        continue;
      }

      const cleared = await this.billingService.stopSupersededOrder(
        subscription.id,
        subscription.pendingUnsubscribeOrderId,
      );
      if (cleared) {
        stopped += 1;
      }
    }

    return stopped;
  }

  private async restrictExpired(now: Date): Promise<number> {
    const due = await this.subscriptionsRepository.listRestrictionDue(now);

    for (const subscription of due) {
      await this.subscriptionsRepository.restrict(subscription.id);
      await this.billingService.notifyOrganizationAdmins({
        organizationId: subscription.organizationId,
        type: 'SUBSCRIPTION_RESTRICTED',
        titleKey: 'subscriptionRestricted',
        bodyMessage: { key: 'subscriptionRestricted' },
        dedupeKey: `restricted:${dayKey(now)}`,
        recipientMembershipIds: subscription.organization.members.map((member) => member.id),
      });
    }

    return due.length;
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
