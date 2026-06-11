import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createEmailProvider, EMAIL_PROVIDER } from './email.provider';
import { EmailService } from './email.service';

@Global()
@Module({
  providers: [
    {
      provide: EMAIL_PROVIDER,
      inject: [ConfigService],
      useFactory: createEmailProvider,
    },
    EmailService,
  ],
  exports: [EmailService],
})
export class EmailModule {}
