import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  SessionAuthGuard,
  type AuthenticatedRequest,
} from '../../common/guards/session-auth.guard';
import { CreateMemberPhotoUploadDto } from '../media/dto/member-photo.dto';
import { MediaService } from '../media/media.service';
import { privateMediaFile } from '../media/private-media-file';
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

  @Get('me/avatar/:assetId')
  async avatar(
    @Param('assetId') assetId: string,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const media = await this.mediaService.readCurrentUserAvatar(this.actorUserId(request), assetId);
    return privateMediaFile(media, response);
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
