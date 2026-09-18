import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@churchflow/db';
import { MediaService } from '../media/media.service';
import { UsersRepository } from './repositories/users.repository';
import type { UpdateCurrentUserProfileInput } from '@churchflow/shared';

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly mediaService: MediaService,
  ) {}

  async findProfile(userId: string) {
    const user = await this.usersRepository.findById(userId);
    if (!user) return null;
    const { avatarAsset, ...profile } = user;
    return {
      ...profile,
      avatarUrl: avatarAsset ? await this.mediaService.signReadUrl(avatarAsset) : user.avatarUrl,
    };
  }

  async updateProfile(userId: string, input: UpdateCurrentUserProfileInput) {
    try {
      return await this.usersRepository.updateProfile(userId, input);
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'LAST_SIGN_IN_METHOD') {
        throw new ConflictException(
          'Add another sign-in method before changing the address you sign in with',
        );
      }

      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Email is already in use');
      }

      throw error;
    }
  }
}
