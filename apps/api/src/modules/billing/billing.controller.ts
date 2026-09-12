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
import {
  SessionAuthGuard,
  type AuthenticatedRequest,
} from '../../common/guards/session-auth.guard';
import {
  OrganizationAccessGuard,
  RequireOrganizationOwner,
} from '../../common/guards/organization-access.guard';
import { BillingService } from './billing.service';
import { LiqPayCallbackDto } from './dto/liqpay-callback.dto';

/**
 * Note the absence of SubscriptionEntitlementGuard on every route here. Billing is the one
 * thing a restricted organization must still be able to do; gating it behind an entitlement
 * would leave an unpaid church with no way to pay.
 *
 * Owner only. Paying for the organization and cancelling that payment is the one thing an
 * administrator does not inherit: the money is the owner's. Platform admins keep access to every
 * organization's billing, because OrganizationAccessGuard clears them before it reaches this
 * check at all.
 */
@Controller()
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('organizations/:organizationId/billing')
  @UseGuards(SessionAuthGuard, OrganizationAccessGuard)
  @RequireOrganizationOwner()
  async getSummary(@Param('organizationId') organizationId: string) {
    return this.billingService.getSummary(organizationId);
  }

  @Post('organizations/:organizationId/billing/checkout')
  @UseGuards(SessionAuthGuard, OrganizationAccessGuard)
  @RequireOrganizationOwner()
  async startCheckout(
    @Param('organizationId') organizationId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.billingService.startCheckout(organizationId, actorUserId(request));
  }

  @Post('organizations/:organizationId/billing/cancel')
  @UseGuards(SessionAuthGuard, OrganizationAccessGuard)
  @RequireOrganizationOwner()
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
