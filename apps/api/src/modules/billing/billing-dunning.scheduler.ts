import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ScheduledJobLockService } from '../scheduled-jobs/scheduled-job-lock.service';
import { BillingService } from './billing.service';
import { SubscriptionsRepository } from './repositories/subscriptions.repository';

const BILLING_DUNNING_JOB = 'billing.dunning';
const BILLING_DUNNING_LOCK_TTL_MS = 10 * 60 * 1000;
const FINAL_WARNING_WINDOW_MS = 24 * 60 * 60 * 1000;
const BILLING_TIME_ZONE = 'Europe/Kyiv';

export interface BillingDunningResult {
  restrictedCount: number;
  warnedCount: number;
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

    this.logger.log({
      event: 'Billing dunning completed',
      restrictedCount: execution.result.restrictedCount,
      warnedCount: execution.result.warnedCount,
    });
  }

  async run(now: Date): Promise<BillingDunningResult> {
    return {
      restrictedCount: await this.restrictExpired(now),
      warnedCount: await this.warnOpenTransitionWindows(now),
    };
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

function dayKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}
