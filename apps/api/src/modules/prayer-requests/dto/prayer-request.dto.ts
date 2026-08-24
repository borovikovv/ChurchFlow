import {
  archivePrayerRequestSchema,
  createPrayerRequestSchema,
  listPrayerRequestsQuerySchema,
  updatePrayerRequestSchema,
} from '@churchflow/shared';
import type {
  ArchivePrayerRequestInput,
  CreatePrayerRequestInput,
  ListPrayerRequestsQuery,
  PrayerRequestTab,
  UpdatePrayerRequestInput,
} from '@churchflow/shared';

export class ListPrayerRequestsQueryDto implements ListPrayerRequestsQuery {
  static readonly schema = listPrayerRequestsQuerySchema;

  tab!: PrayerRequestTab;
  cursor!: ListPrayerRequestsQuery['cursor'];
  page!: number;
  pageSize!: ListPrayerRequestsQuery['pageSize'];
}

export class CreatePrayerRequestDto implements CreatePrayerRequestInput {
  static readonly schema = createPrayerRequestSchema;

  title!: string;
  description!: string;
}

export class UpdatePrayerRequestDto implements UpdatePrayerRequestInput {
  static readonly schema = updatePrayerRequestSchema;

  title?: string;
  description?: string;
}

export class ArchivePrayerRequestDto implements ArchivePrayerRequestInput {
  static readonly schema = archivePrayerRequestSchema;

  archiveReason?: string | null;
}
