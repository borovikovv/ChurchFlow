import { Module } from '@nestjs/common';
import { ScheduledJobLockService } from './scheduled-job-lock.service';

@Module({
  providers: [ScheduledJobLockService],
  exports: [ScheduledJobLockService],
})
export class ScheduledJobsModule {}
