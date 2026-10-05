import { Module } from '@nestjs/common';
import { OrganizationAccessGuard } from '../../common/guards/organization-access.guard';
import { BillingModule } from '../billing/billing.module';
import { ImportantDatesController } from './important-dates.controller';
import { ImportantDatesService } from './important-dates.service';
import { KnowledgeEntriesController } from './knowledge-entries.controller';
import { KnowledgeEntriesService } from './knowledge-entries.service';
import { ImportantDatesRepository } from './repositories/important-dates.repository';
import { KnowledgeEntriesRepository } from './repositories/knowledge-entries.repository';

@Module({
  imports: [BillingModule],
  controllers: [KnowledgeEntriesController, ImportantDatesController],
  providers: [
    OrganizationAccessGuard,
    KnowledgeEntriesService,
    KnowledgeEntriesRepository,
    ImportantDatesService,
    ImportantDatesRepository,
  ],
  exports: [KnowledgeEntriesService, ImportantDatesService],
})
export class KnowledgeModule {}
