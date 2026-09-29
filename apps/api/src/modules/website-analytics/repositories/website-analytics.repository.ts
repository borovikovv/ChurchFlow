import { Injectable } from '@nestjs/common';
import type { Prisma } from '@churchflow/db';
import { WEBSITE_ANALYTICS_AUDIT_ACTIONS } from '@churchflow/shared';
import { PrismaService } from '../../../prisma/prisma.service';

const AUDIT_ENTITY_TYPE = 'WebsiteAnalyticsIntegration';

type AuditAction =
  (typeof WEBSITE_ANALYTICS_AUDIT_ACTIONS)[keyof typeof WEBSITE_ANALYTICS_AUDIT_ACTIONS];

@Injectable()
export class WebsiteAnalyticsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByOrganizationId(organizationId: string) {
    return this.prisma.websiteAnalyticsIntegration.findUnique({ where: { organizationId } });
  }

  /**
   * A reconnect keeps the property already chosen, so an owner fixing revoked access does not
   * have to pick it again, and a site tracked by a manual id keeps being tracked until a property
   * replaces it.
   */
  connectOAuth(input: {
    organizationId: string;
    actorUserId: string;
    encryptedRefreshToken: string;
    googleAccountEmail: string | null;
  }) {
    const { organizationId, actorUserId, encryptedRefreshToken, googleAccountEmail } = input;

    return this.prisma.$transaction(async (tx) => {
      const integration = await tx.websiteAnalyticsIntegration.upsert({
        where: { organizationId },
        create: {
          organizationId,
          mode: 'OAUTH',
          status: 'CONNECTED',
          encryptedRefreshToken,
          googleAccountEmail,
        },
        update: { mode: 'OAUTH', status: 'CONNECTED', encryptedRefreshToken, googleAccountEmail },
      });

      await this.audit(tx, {
        organizationId,
        actorUserId,
        entityId: integration.id,
        action: WEBSITE_ANALYTICS_AUDIT_ACTIONS.connect,
        metadata: { mode: 'OAUTH' },
      });

      return integration;
    });
  }

  selectProperty(input: {
    organizationId: string;
    actorUserId: string;
    gaAccountId: string;
    propertyId: string;
    propertyDisplayName: string;
    streamId: string;
    measurementId: string;
  }) {
    const { organizationId, actorUserId, ...selection } = input;

    return this.prisma.$transaction(async (tx) => {
      const integration = await tx.websiteAnalyticsIntegration.update({
        where: { organizationId },
        data: selection,
      });

      await this.audit(tx, {
        organizationId,
        actorUserId,
        entityId: integration.id,
        action: WEBSITE_ANALYTICS_AUDIT_ACTIONS.selectProperty,
        metadata: {
          propertyId: selection.propertyId,
          streamId: selection.streamId,
          measurementId: selection.measurementId,
        },
      });

      return integration;
    });
  }

  /** Manual mode tracks only: whatever Google grant existed is dropped along with its property. */
  setManualMeasurementId(input: {
    organizationId: string;
    actorUserId: string;
    measurementId: string;
  }) {
    const { organizationId, actorUserId, measurementId } = input;
    const manual = {
      mode: 'MANUAL',
      status: 'CONNECTED',
      measurementId,
      encryptedRefreshToken: null,
      googleAccountEmail: null,
      gaAccountId: null,
      propertyId: null,
      propertyDisplayName: null,
      streamId: null,
    } satisfies Prisma.WebsiteAnalyticsIntegrationUpdateInput;

    return this.prisma.$transaction(async (tx) => {
      const integration = await tx.websiteAnalyticsIntegration.upsert({
        where: { organizationId },
        create: { organizationId, ...manual },
        update: manual,
      });

      await this.audit(tx, {
        organizationId,
        actorUserId,
        entityId: integration.id,
        action: WEBSITE_ANALYTICS_AUDIT_ACTIONS.setMeasurementId,
        metadata: { measurementId },
      });

      return integration;
    });
  }

  disconnect(input: { organizationId: string; actorUserId: string }) {
    const { organizationId, actorUserId } = input;

    return this.prisma.$transaction(async (tx) => {
      const integration = await tx.websiteAnalyticsIntegration.delete({
        where: { organizationId },
      });

      await this.audit(tx, {
        organizationId,
        actorUserId,
        entityId: integration.id,
        action: WEBSITE_ANALYTICS_AUDIT_ACTIONS.disconnect,
        metadata: { mode: integration.mode, measurementId: integration.measurementId },
      });

      return integration;
    });
  }

  /**
   * Not audited: Google revoked the grant, nobody in the organization changed anything. Matched on
   * the token that failed, so a request still running on an old grant cannot flag a reconnect
   * that finished in the meantime.
   */
  async markNeedsReauth(integration: {
    organizationId: string;
    encryptedRefreshToken: string | null;
  }): Promise<void> {
    await this.prisma.websiteAnalyticsIntegration.updateMany({
      where: {
        organizationId: integration.organizationId,
        mode: 'OAUTH',
        encryptedRefreshToken: integration.encryptedRefreshToken,
      },
      data: { status: 'NEEDS_REAUTH' },
    });
  }

  private async audit(
    tx: Prisma.TransactionClient,
    input: {
      organizationId: string;
      actorUserId: string;
      entityId: string;
      action: AuditAction;
      metadata: Prisma.InputJsonObject;
    },
  ): Promise<void> {
    await tx.auditLog.create({
      data: {
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        action: input.action,
        entityType: AUDIT_ENTITY_TYPE,
        entityId: input.entityId,
        metadata: input.metadata,
      },
    });
  }
}
