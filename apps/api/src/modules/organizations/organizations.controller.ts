import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { createOrganizationSchema } from '@churchflow/shared';
import { JwtAuthGuard, type AuthenticatedRequest } from '../../common/guards/jwt-auth.guard';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { OrganizationsService } from './organizations.service';

@Controller('organizations')
@UseGuards(JwtAuthGuard)
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Post()
  async create(@Body() body: CreateOrganizationDto, @Req() request: AuthenticatedRequest) {
    const auth = request.auth;
    if (!auth) {
      throw new Error('Authenticated request missing auth payload');
    }

    return this.organizationsService.create(createOrganizationSchema.parse(body), auth.sub);
  }
}
