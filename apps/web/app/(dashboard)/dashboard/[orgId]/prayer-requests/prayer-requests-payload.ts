import type { ListPrayerRequestsQuery, PrayerRequestsPayload } from '@churchflow/shared';
import { DEFAULT_PRAYER_REQUEST_PAGE_SIZE } from '@churchflow/shared';

export function createEmptyPrayerRequestsPayload(
  query: ListPrayerRequestsQuery,
): PrayerRequestsPayload {
  return {
    actorRole: null,
    actorMembershipId: null,
    tab: query.tab,
    items: [],
    counts: { active: 0, archived: 0 },
    pagination: {
      page: query.page,
      pageSize: query.pageSize ?? DEFAULT_PRAYER_REQUEST_PAGE_SIZE,
      total: 0,
      pageCount: 1,
      nextCursor: null,
    },
  };
}
