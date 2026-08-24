import type {
  ArchivePrayerRequestInput,
  PrayerRequestItem,
  PrayerRequestsPayload,
  UpdatePrayerRequestInput,
} from '@churchflow/shared';

export interface PrayerRequestsListProps {
  disabled: boolean;
  payload: PrayerRequestsPayload;
  onUpdate: (requestId: string, request: UpdatePrayerRequestInput) => void;
  onArchive: (requestId: string, request: ArchivePrayerRequestInput) => void;
  onRestore: (requestId: string) => void;
  onDelete: (request: PrayerRequestItem) => Promise<void>;
}
