import type {
  ArchivePrayerRequestInput,
  PrayerRequestItem,
  PrayerRequestsPayload,
  UpdatePrayerRequestInput,
} from '@churchflow/shared';

/** Shared by the desktop table and the mobile card list, which render the same collection. */
export interface PrayerRequestsListProps {
  disabled: boolean;
  payload: PrayerRequestsPayload;
  onUpdate: (requestId: string, request: UpdatePrayerRequestInput) => void;
  onArchive: (requestId: string, request: ArchivePrayerRequestInput) => void;
  onRestore: (requestId: string) => void;
  onDelete: (request: PrayerRequestItem) => Promise<void>;
}
