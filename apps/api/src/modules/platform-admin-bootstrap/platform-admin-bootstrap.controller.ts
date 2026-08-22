import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { SessionAuthGuard, type AuthenticatedRequest } from '../../common/guards/session-auth.guard';
import {
  ConsumePlatformAdminBootstrapDto,
  consumePlatformAdminBootstrapSchema,
} from './dto/consume-platform-admin-bootstrap.dto';
import { PlatformAdminBootstrapService } from './platform-admin-bootstrap.service';

@Controller('platform-admin/bootstrap')
export class PlatformAdminBootstrapController {
  constructor(private readonly service: PlatformAdminBootstrapService) {}

  @Post('validate')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async validate(@Body() body: ConsumePlatformAdminBootstrapDto) {
    const parsed = consumePlatformAdminBootstrapSchema.parse(body);
    return this.service.validate(parsed.token);
  }

  @Post('consume')
  @UseGuards(SessionAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async consume(
    @Body() body: ConsumePlatformAdminBootstrapDto,
    @Req() request: AuthenticatedRequest,
  ) {
    const userId = request.auth?.userId;
    if (!userId) {
      throw new Error('Authenticated request missing auth payload');
    }

    return this.service.consume(body.token, userId);
  }
}
