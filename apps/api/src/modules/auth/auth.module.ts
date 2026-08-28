import { Module } from '@nestjs/common';
import { ScheduledJobsModule } from '../scheduled-jobs/scheduled-jobs.module';
import { AuthController } from './auth.controller';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';
import { EmailAuthController } from './email/email-auth.controller';
import { EmailAuthRepository } from './email/email-auth.repository';
import { EmailAuthService } from './email/email-auth.service';
import { PasskeysController } from './passkeys/passkeys.controller';
import { PasskeysRepository } from './passkeys/passkeys.repository';
import { PasskeysService } from './passkeys/passkeys.service';
import { SessionsRetentionScheduler } from './sessions-retention.scheduler';

@Module({
  imports: [ScheduledJobsModule],
  controllers: [AuthController, EmailAuthController, PasskeysController],
  providers: [
    AuthService,
    AuthRepository,
    EmailAuthService,
    EmailAuthRepository,
    PasskeysService,
    PasskeysRepository,
    SessionsRetentionScheduler,
  ],
  exports: [AuthService],
})
export class AuthModule {}
