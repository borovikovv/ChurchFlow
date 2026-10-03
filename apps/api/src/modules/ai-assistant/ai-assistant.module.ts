import { Module } from '@nestjs/common';
import { OrganizationAccessGuard } from '../../common/guards/organization-access.guard';
import { PlatformAdminGuard } from '../../common/guards/platform-admin.guard';
import { BillingModule } from '../billing/billing.module';
import { BudgetsModule } from '../budgets/budgets.module';
import { CalendarEventsModule } from '../calendar-events/calendar-events.module';
import { GroupsModule } from '../groups/groups.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { MembershipsModule } from '../memberships/memberships.module';
import { PrayerRequestsModule } from '../prayer-requests/prayer-requests.module';
import { ScheduledJobsModule } from '../scheduled-jobs/scheduled-jobs.module';
import { AiAssistantAdminController } from './ai-assistant-admin.controller';
import { AiAssistantController } from './ai-assistant.controller';
import { AiAssistantService } from './ai-assistant.service';
import { AiConversationsRetentionScheduler } from './ai-conversations-retention.scheduler';
import { AiModelProvider } from './ai-model.provider';
import { AiAssistantRepository } from './repositories/ai-assistant.repository';

@Module({
  imports: [
    BillingModule,
    ScheduledJobsModule,
    MembershipsModule,
    GroupsModule,
    CalendarEventsModule,
    PrayerRequestsModule,
    BudgetsModule,
    KnowledgeModule,
  ],
  controllers: [AiAssistantController, AiAssistantAdminController],
  providers: [
    OrganizationAccessGuard,
    PlatformAdminGuard,
    AiAssistantService,
    AiAssistantRepository,
    AiModelProvider,
    AiConversationsRetentionScheduler,
  ],
})
export class AiAssistantModule {}
