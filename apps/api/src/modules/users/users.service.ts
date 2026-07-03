import { Injectable } from '@nestjs/common';
import { UsersRepository } from './repositories/users.repository';
import type { UpdateCurrentUserProfileInput } from '@churchflow/shared';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async findProfile(userId: string) {
    return this.usersRepository.findById(userId);
  }

  async updateProfile(userId: string, input: UpdateCurrentUserProfileInput) {
    return this.usersRepository.updateProfile(userId, input);
  }
}
