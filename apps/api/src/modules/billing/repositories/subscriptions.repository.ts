import { Injectable } from '@nestjs/common';
import type { SubscriptionEntitlementState } from '@churchflow/shared';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class SubscriptionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findEntitlementState(organizationId: string): Promise<SubscriptionEntitlementState | null> {
    return this.prisma.subscription.findUnique({
      where: { organizationId },
      select: {
        status: true,
        isExempt: true,
        restrictAfter: true,
        graceEndsAt: true,
      },
    });
  }

  findByOrganizationId(organizationId: string) {
    return this.prisma.subscription.findUnique({ where: { organizationId } });
  }
}
