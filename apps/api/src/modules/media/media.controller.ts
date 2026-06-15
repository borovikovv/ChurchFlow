import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OrganizationAccessGuard } from '../../common/guards/organization-access.guard';
import { MediaService } from './media.service';

@Controller('organizations/:organizationId/media')
@UseGuards(JwtAuthGuard, OrganizationAccessGuard)
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Get()
  async list(@Param('organizationId') organizationId: string) {
    return this.mediaService.listForOrganization(organizationId);
  }
}
