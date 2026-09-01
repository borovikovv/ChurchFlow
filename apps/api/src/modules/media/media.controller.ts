import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '../../common/guards/session-auth.guard';
import { SessionAuthGuard } from '../../common/guards/session-auth.guard';
import { ENTITLEMENTS } from '@churchflow/shared';
import { OrganizationAccessGuard } from '../../common/guards/organization-access.guard';
import {
  RequireEntitlement,
  SubscriptionEntitlementGuard,
} from '../../common/guards/subscription-entitlement.guard';
import { MediaService } from './media.service';
import { ConfirmMemberPhotoUploadDto, CreateMemberPhotoUploadDto } from './dto/member-photo.dto';

@Controller('organizations/:organizationId/media')
@UseGuards(SessionAuthGuard, OrganizationAccessGuard, SubscriptionEntitlementGuard)
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Get()
  async list(@Param('organizationId') organizationId: string) {
    return this.mediaService.listForOrganization(organizationId);
  }

  @Post('calendar-events/image-upload')
  @RequireEntitlement(ENTITLEMENTS.filesUpload)
  createCalendarEventImageUpload(
    @Param('organizationId') organizationId: string,
    @Body() body: CreateMemberPhotoUploadDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.mediaService.createCalendarEventImageUpload(
      organizationId,
      body,
      this.actorUserId(request),
    );
  }

  @Post('calendar-events/image-confirm')
  @RequireEntitlement(ENTITLEMENTS.filesUpload)
  confirmCalendarEventImage(
    @Param('organizationId') organizationId: string,
    @Body() body: ConfirmMemberPhotoUploadDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.mediaService.confirmCalendarEventImage(
      organizationId,
      body.assetId,
      this.actorUserId(request),
    );
  }

  @Post('website-sections/background-upload')
  @RequireEntitlement(ENTITLEMENTS.filesUpload)
  createWebsiteSectionBackgroundUpload(
    @Param('organizationId') organizationId: string,
    @Body() body: CreateMemberPhotoUploadDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.mediaService.createWebsiteSectionBackgroundUpload(
      organizationId,
      body,
      this.actorUserId(request),
    );
  }

  @Post('website-sections/background-confirm')
  @RequireEntitlement(ENTITLEMENTS.filesUpload)
  confirmWebsiteSectionBackground(
    @Param('organizationId') organizationId: string,
    @Body() body: ConfirmMemberPhotoUploadDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.mediaService.confirmWebsiteSectionBackground(
      organizationId,
      body.assetId,
      this.actorUserId(request),
    );
  }

  @Post('organization-logo/upload')
  @RequireEntitlement(ENTITLEMENTS.filesUpload)
  createOrganizationLogoUpload(
    @Param('organizationId') organizationId: string,
    @Body() body: CreateMemberPhotoUploadDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.mediaService.createOrganizationLogoUpload(
      organizationId,
      body,
      this.actorUserId(request),
    );
  }

  @Post('organization-logo/confirm')
  @RequireEntitlement(ENTITLEMENTS.filesUpload)
  confirmOrganizationLogo(
    @Param('organizationId') organizationId: string,
    @Body() body: ConfirmMemberPhotoUploadDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.mediaService.confirmOrganizationLogo(
      organizationId,
      body.assetId,
      this.actorUserId(request),
    );
  }

  @Post('members/:membershipId/photo-upload')
  @RequireEntitlement(ENTITLEMENTS.filesUpload)
  createPhotoUpload(
    @Param('organizationId') organizationId: string,
    @Param('membershipId') membershipId: string,
    @Body() body: CreateMemberPhotoUploadDto,
    @Req() request: AuthenticatedRequest,
  ) {
    const actorUserId = this.actorUserId(request);
    return this.mediaService.createMemberPhotoUpload(
      organizationId,
      membershipId,
      body,
      actorUserId,
    );
  }
  @Post('members/:membershipId/photo-confirm')
  @RequireEntitlement(ENTITLEMENTS.filesUpload)
  confirmPhoto(
    @Param('organizationId') organizationId: string,
    @Param('membershipId') membershipId: string,
    @Body() body: ConfirmMemberPhotoUploadDto,
    @Req() request: AuthenticatedRequest,
  ) {
    const actorUserId = this.actorUserId(request);
    return this.mediaService.confirmMemberPhoto(
      organizationId,
      membershipId,
      body.assetId,
      actorUserId,
    );
  }
  @Get(':assetId/read-url')
  readUrl(@Param('organizationId') organizationId: string, @Param('assetId') assetId: string) {
    return this.mediaService.getReadUrl(assetId, organizationId);
  }

  private actorUserId(request: AuthenticatedRequest): string {
    if (!request.auth) throw new Error('Authenticated request missing auth payload');
    return request.auth.userId;
  }
}
