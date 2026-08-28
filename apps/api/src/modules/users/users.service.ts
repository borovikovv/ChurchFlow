import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@churchflow/db';
import { UsersRepository } from './repositories/users.repository';
import type { UpdateCurrentUserProfileInput } from '@churchflow/shared';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async findProfile(userId: string) {
    return this.usersRepository.findById(userId);
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
