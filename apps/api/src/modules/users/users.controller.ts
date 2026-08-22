import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { SessionAuthGuard, type AuthenticatedRequest } from '../../common/guards/session-auth.guard';
import { UsersService } from './users.service';
import { UpdateCurrentUserProfileDto } from './dto/update-current-user-profile.dto';

@Controller('users')
@UseGuards(SessionAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async me(@Req() request: AuthenticatedRequest) {
    if (!request.auth) {
      throw new Error('Authenticated request missing auth payload');
    }

    return this.usersService.findProfile(request.auth.userId);
  }

  @Patch('me')
  async updateMe(@Body() body: UpdateCurrentUserProfileDto, @Req() request: AuthenticatedRequest) {
    if (!request.auth) throw new Error('Authenticated request missing auth payload');
    return this.usersService.updateProfile(request.auth.userId, body);
  }
}
