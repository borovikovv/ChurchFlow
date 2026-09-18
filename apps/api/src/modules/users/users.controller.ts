import { Body, Controller, Delete, Get, Patch, Post, Req, UseGuards } from '@nestjs/common';
import {
  SessionAuthGuard,
  type AuthenticatedRequest,
} from '../../common/guards/session-auth.guard';
import { CreateMemberPhotoUploadDto } from '../media/dto/member-photo.dto';
import { MediaService } from '../media/media.service';
import { UsersService } from './users.service';
import { ConfirmUserAvatarUploadDto } from './dto/confirm-user-avatar-upload.dto';
import { UpdateCurrentUserProfileDto } from './dto/update-current-user-profile.dto';

@Controller('users')
@UseGuards(SessionAuthGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly mediaService: MediaService,
  ) {}

  @Get('me')
  async me(@Req() request: AuthenticatedRequest) {
    return this.usersService.findProfile(this.actorUserId(request));
  }

  @Patch('me')
  async updateMe(@Body() body: UpdateCurrentUserProfileDto, @Req() request: AuthenticatedRequest) {
    return this.usersService.updateProfile(this.actorUserId(request), body);
  }

  @Post('me/avatar/upload')
  createAvatarUpload(
    @Body() body: CreateMemberPhotoUploadDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.mediaService.createUserAvatarUpload(this.actorUserId(request), body);
  }

  @Post('me/avatar/confirm')
  confirmAvatar(@Body() body: ConfirmUserAvatarUploadDto, @Req() request: AuthenticatedRequest) {
    return this.mediaService.confirmUserAvatar(this.actorUserId(request), body);
  }

  @Delete('me/avatar')
  removeAvatar(@Req() request: AuthenticatedRequest) {
    return this.mediaService.removeUserAvatar(this.actorUserId(request));
  }

  private actorUserId(request: AuthenticatedRequest): string {
    if (!request.auth) throw new Error('Authenticated request missing auth payload');
    return request.auth.userId;
  }
}
