import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, type AuthenticatedRequest } from '../../common/guards/jwt-auth.guard';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async me(@Req() request: AuthenticatedRequest) {
    if (!request.auth) {
      throw new Error('Authenticated request missing auth payload');
    }

    return this.usersService.findProfile(request.auth.sub);
  }
}
