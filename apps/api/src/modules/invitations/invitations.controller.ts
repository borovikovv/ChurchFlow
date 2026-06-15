import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { invitationTokenQuerySchema } from '@churchflow/shared';
import { JwtAuthGuard, type AuthenticatedRequest } from '../../common/guards/jwt-auth.guard';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { CreateOrganizationInvitationDto } from './dto/create-organization-invitation.dto';
import { InvitationsService } from './invitations.service';

@Controller()
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @Post('organizations/:organizationId/invitations')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async create(
    @Param('organizationId') organizationId: string,
    @Body() body: CreateOrganizationInvitationDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.invitationsService.createForOrganization(organizationId, body, this.getActorUserId(request));
  }

  @Get('invitations/validate')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async validate(@Query('token') token: string) {
    return this.invitationsService.validate(invitationTokenQuerySchema.parse({ token }).token);
  }

  @Post('invitations/accept')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async accept(@Body() body: AcceptInvitationDto, @Req() request: AuthenticatedRequest) {
    return this.invitationsService.accept(body.token, this.getActorUserId(request));
  }

  @Post('organizations/:organizationId/invitations/:id/revoke')
  @UseGuards(JwtAuthGuard)
  async revoke(
    @Param('organizationId') organizationId: string,
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest
  ) {
    return this.invitationsService.revoke(organizationId, id, this.getActorUserId(request));
  }

  @Post('organizations/:organizationId/invitations/:id/resend')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async resend(
    @Param('organizationId') organizationId: string,
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest
  ) {
    return this.invitationsService.resend(organizationId, id, this.getActorUserId(request));
  }

  private getActorUserId(request: AuthenticatedRequest): string {
    const userId = request.auth?.sub;
    if (!userId) {
      throw new Error('Authenticated request missing auth payload');
    }

    return userId;
  }
}
