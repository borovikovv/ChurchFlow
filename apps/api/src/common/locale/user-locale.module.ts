import { Global, Module } from '@nestjs/common';
import { UserLocaleService } from './user-locale.service';

@Global()
@Module({
  providers: [UserLocaleService],
  exports: [UserLocaleService],
})
export class UserLocaleModule {}
