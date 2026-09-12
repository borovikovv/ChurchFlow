import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ENTITLEMENTS, membershipClaimTokenSchema } from '@churchflow/shared';
import {
  SessionAuthGuard,
  type AuthenticatedRequest,
} from '../../common/guards/session-auth.guard';
import { OrganizationAccessGuard } from '../../common/guards/organization-access.guard';
import {
  RequireEntitlement,
  SubscriptionEntitlementGuard,
} from '../../common/guards/subscription-entitlement.guard';
import { MembershipClaimTokenDto } from './dto/membership-claim-token.dto';
import { MembershipClaimsService } from './membership-claims.service';

@Controller()
export class MembershipClaimsController {
  constructor(private readonly service: MembershipClaimsService) {}

  @Get('membership-claims/validate')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  validate(@Query('token') token: string) {
    return this.service.validate(membershipClaimTokenSchema.parse({ token }).token);
  }

  @Post('membership-claims/request')
  @UseGuards(SessionAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  request(@Body() body: MembershipClaimTokenDto, @Req() request: AuthenticatedRequest) {
    return this.service.request(body.token, this.actor(request));
  }

  @Get('membership-claims/status')
  @UseGuards(SessionAuthGuard)
  status(@Req() request: AuthenticatedRequest) {
    return this.service.status(this.actor(request));
  }

  @Post('organizations/:organizationId/memberships/:membershipId/claim')
  @UseGuards(SessionAuthGuard, OrganizationAccessGuard, SubscriptionEntitlementGuard)
  @RequireEntitlement(ENTITLEMENTS.membersWrite)
  generate(
    @Param('organizationId') organizationId: string,
    @Param('membershipId') membershipId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.generate(organizationId, membershipId, this.actor(request));
  }

  @Post('organizations/:organizationId/membership-claims/:claimId/refresh')
  @UseGuards(SessionAuthGuard, OrganizationAccessGuard, SubscriptionEntitlementGuard)
  @RequireEntitlement(ENTITLEMENTS.membersWrite)
  refresh(
    @Param('organizationId') organizationId: string,
    @Param('claimId') claimId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.refresh(organizationId, claimId, this.actor(request));
  }

  @Post('organizations/:organizationId/membership-claims/:claimId/revoke')
  @UseGuards(SessionAuthGuard, OrganizationAccessGuard, SubscriptionEntitlementGuard)
  @RequireEntitlement(ENTITLEMENTS.membersWrite)
  revoke(
    @Param('organizationId') organizationId: string,
    @Param('claimId') claimId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.revoke(organizationId, claimId, this.actor(request));
  }

  @Post('organizations/:organizationId/membership-claims/:claimId/approve')
  @UseGuards(SessionAuthGuard, OrganizationAccessGuard, SubscriptionEntitlementGuard)
  @RequireEntitlement(ENTITLEMENTS.membersWrite)
  approve(
    @Param('organizationId') organizationId: string,
    @Param('claimId') claimId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.approve(organizationId, claimId, this.actor(request));
  }

  @Post('organizations/:organizationId/membership-claims/:claimId/reject')
  @UseGuards(SessionAuthGuard, OrganizationAccessGuard, SubscriptionEntitlementGuard)
  @RequireEntitlement(ENTITLEMENTS.membersWrite)
  reject(
    @Param('organizationId') organizationId: string,
    @Param('claimId') claimId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.reject(organizationId, claimId, this.actor(request));
  }

  private actor(request: AuthenticatedRequest): string {
    const actorUserId = request.auth?.userId;
    if (!actorUserId) throw new Error('Authenticated request missing auth payload');
    return actorUserId;
  }
}
