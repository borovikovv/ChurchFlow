import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { MembershipsService } from './memberships.service';

@Controller('organizations/:organizationId/memberships')
@UseGuards(JwtAuthGuard)
export class MembershipsController {
  constructor(private readonly membershipsService: MembershipsService) {}

  @Get()
  async list(@Param('organizationId') organizationId: string) {
    return this.membershipsService.listForOrganization(organizationId);
  }
}
