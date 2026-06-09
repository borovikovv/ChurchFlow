import { Injectable } from '@nestjs/common';
import { UsersRepository } from './repositories/users.repository';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async findProfile(userId: string) {
    return this.usersRepository.findById(userId);
  }
}
