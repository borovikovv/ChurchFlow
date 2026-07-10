import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '../../common/guards/jwt-auth.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OrganizationAccessGuard } from '../../common/guards/organization-access.guard';
import { MediaService } from './media.service';
import { ConfirmMemberPhotoUploadDto, CreateMemberPhotoUploadDto } from './dto/member-photo.dto';

@Controller('organizations/:organizationId/media')
@UseGuards(JwtAuthGuard, OrganizationAccessGuard)
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Get()
  async list(@Param('organizationId') organizationId: string) {
    return this.mediaService.listForOrganization(organizationId);
  }

  @Post('calendar-events/image-upload')
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

  @Post('members/:membershipId/photo-upload')
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
    return request.auth.sub;
  }
}
