'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import type {
  OrganizationMembersAccessFilter,
  MemberMinistry,
  OrganizationMembersTypeFilter,
} from '@churchflow/shared';
import { loadMembersAction } from '../actions';
import type { MembersPayload } from '../types';

export function useMembersQuery({
  access,
  initialPayload,
  ministries,
  organizationId,
  page,
  pageSize,
  search,
  type,
}: {
  access: OrganizationMembersAccessFilter;
  initialPayload: MembersPayload;
  ministries: MemberMinistry[];
  organizationId: string;
  page: number;
  pageSize: number;
  search: string;
  type: OrganizationMembersTypeFilter;
}) {
  const queryClient = useQueryClient();
  const ministriesKey = ministries.join(',');
  const queryKey = useMemo(
    () =>
      [
        'organization-members',
        organizationId,
        access,
        type,
        search,
        ministriesKey,
        page,
        pageSize,
      ] as const,
    [access, ministriesKey, organizationId, page, pageSize, search, type],
  );
  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const result = await loadMembersAction({
        organizationId,
        access,
        ministries,
        page,
        pageSize,
        type,
        search,
      });
      if (!result.ok) throw new Error(result.error);
      return result.payload;
    },
    initialData: initialPayload,
  });
  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey });
  }, [queryClient, queryKey]);

  return { ...query, refresh };
}
