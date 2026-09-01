'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import type {
  OrganizationMembersAccessFilter,
  OrganizationMembersTab,
  OrganizationMembersTypeFilter,
} from '@churchflow/shared';
import { loadMembersAction } from '../actions';
import type { MembersPayload } from '../types';

const MEMBERS_QUERY_KEY = 'organization-members';

function membersQueryKeyPrefix(organizationId: string) {
  return [MEMBERS_QUERY_KEY, organizationId] as const;
}

export function useRefreshMembers(organizationId: string): () => void {
  const queryClient = useQueryClient();

  return useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: membersQueryKeyPrefix(organizationId) });
  }, [organizationId, queryClient]);
}

export function useMembersQuery({
  access,
  initialPayload,
  groups,
  organizationId,
  page,
  pageSize,
  search,
  tab,
  type,
}: {
  access: OrganizationMembersAccessFilter;
  initialPayload: MembersPayload;
  groups: string[];
  organizationId: string;
  page: number;
  pageSize: number;
  search: string;
  tab: OrganizationMembersTab;
  type: OrganizationMembersTypeFilter;
}) {
  const queryClient = useQueryClient();
  const groupsKey = groups.join(',');
  const queryKey = useMemo(
    () =>
      [
        ...membersQueryKeyPrefix(organizationId),
        access,
        type,
        search,
        groupsKey,
        page,
        pageSize,
        tab,
      ] as const,
    [access, groupsKey, organizationId, page, pageSize, search, tab, type],
  );
  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const result = await loadMembersAction({
        organizationId,
        access,
        groups,
        page,
        pageSize,
        tab,
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
