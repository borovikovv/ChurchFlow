import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, type AuthenticatedRequest } from '../../common/guards/jwt-auth.guard';
import { AuditService } from './audit.service';
import { ListAuditLogsQueryDto } from './dto/list-audit-logs-query.dto';

@Controller('organizations/:organizationId/audit-logs')
@UseGuards(JwtAuthGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  list(
    @Param('organizationId') organizationId: string,
    @Query() query: ListAuditLogsQueryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.auditService.listForOrganization(organizationId, this.actorUserId(request), query);
  }

  private actorUserId(request: AuthenticatedRequest): string {
    if (!request.auth) {
      throw new Error('Authenticated request missing auth payload');
    }

    return request.auth.sub;
  }
}
