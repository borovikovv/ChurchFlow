import { Module } from '@nestjs/common';
import { ScheduledJobsModule } from '../scheduled-jobs/scheduled-jobs.module';
import { AuthController } from './auth.controller';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';
import { SessionsRetentionScheduler } from './sessions-retention.scheduler';

@Module({
  imports: [ScheduledJobsModule],
  controllers: [AuthController],
  providers: [AuthService, AuthRepository, SessionsRetentionScheduler],
  exports: [AuthService],
})
export class AuthModule {}
