import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module';
import { UsersController } from './users.controller';
import { UsersRepository } from './repositories/users.repository';
import { UsersService } from './users.service';

@Module({
  imports: [MediaModule],
  controllers: [UsersController],
  providers: [UsersService, UsersRepository],
  exports: [UsersService],
})
export class UsersModule {}
