'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import type {
  OrganizationMembersAccessFilter,
  OrganizationMembersTypeFilter,
} from '@churchflow/shared';
import { loadMembersAction } from '../actions';
import type { MembersPayload } from '../types';

export function useMembersQuery({
  access,
  initialPayload,
  organizationId,
  search,
  type,
}: {
  access: OrganizationMembersAccessFilter;
  initialPayload: MembersPayload;
  organizationId: string;
  search: string;
  type: OrganizationMembersTypeFilter;
}) {
  const queryClient = useQueryClient();
  const queryKey = useMemo(
    () => ['organization-members', organizationId, access, type, search] as const,
    [access, organizationId, search, type],
  );
  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const result = await loadMembersAction({ organizationId, access, type, search });
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
