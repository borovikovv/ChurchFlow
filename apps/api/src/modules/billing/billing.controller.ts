import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ORG_PERMISSIONS } from '@churchflow/shared';
import {
  SessionAuthGuard,
  type AuthenticatedRequest,
} from '../../common/guards/session-auth.guard';
import {
  OrganizationAccessGuard,
  RequireOrganizationPermission,
} from '../../common/guards/organization-access.guard';
import { BillingService } from './billing.service';
import { LiqPayCallbackDto } from './dto/liqpay-callback.dto';

/**
 * Note the absence of SubscriptionEntitlementGuard on every route here. Billing is the one
 * thing a restricted organization must still be able to do; gating it behind an entitlement
 * would leave an unpaid church with no way to pay.
 *
 * `billing.manage` is required rather than plain membership. OWNER and ADMIN bypass permission
 * checks in OrganizationAccessGuard, so this reads as "owners, admins, or a member explicitly
 * given billing access" without a second rule to keep in step.
 */
@Controller()
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('organizations/:organizationId/billing')
  @UseGuards(SessionAuthGuard, OrganizationAccessGuard)
  @RequireOrganizationPermission(ORG_PERMISSIONS.billingManage)
  async getSummary(@Param('organizationId') organizationId: string) {
    return this.billingService.getSummary(organizationId);
  }

  @Post('organizations/:organizationId/billing/checkout')
  @UseGuards(SessionAuthGuard, OrganizationAccessGuard)
  @RequireOrganizationPermission(ORG_PERMISSIONS.billingManage)
  async startCheckout(
    @Param('organizationId') organizationId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.billingService.startCheckout(organizationId, actorUserId(request));
  }

  @Post('organizations/:organizationId/billing/cancel')
  @UseGuards(SessionAuthGuard, OrganizationAccessGuard)
  @RequireOrganizationPermission(ORG_PERMISSIONS.billingManage)
  async cancel(
    @Param('organizationId') organizationId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.billingService.cancel(organizationId, actorUserId(request));
  }

  /**
   * Unauthenticated on purpose: LiqPay carries no session. The signature over `data` is the
   * authentication, which is why there is no shared secret in the path the way the Telegram
   * webhook does it - a URL secret leaks through logs and referrers.
   */
  @Post('billing/liqpay/callback')
  @HttpCode(HttpStatus.OK)
  async handleLiqPayCallback(@Body() body: LiqPayCallbackDto) {
    return this.billingService.handleCallback(body.data, body.signature);
  }
}

function actorUserId(request: AuthenticatedRequest): string {
  const userId = request.auth?.userId;
  if (!userId) {
    throw new Error('Authenticated request missing auth payload');
  }

  return userId;
}
