'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import type { OrganizationMembersAccessFilter } from '@churchflow/shared';
import { loadMembersAction } from '../actions';
import type { MembersPayload } from '../types';

export function useMembersQuery({
  access,
  initialPayload,
  organizationId,
}: {
  access: OrganizationMembersAccessFilter;
  initialPayload: MembersPayload;
  organizationId: string;
}) {
  const queryClient = useQueryClient();
  const queryKey = useMemo(
    () => ['organization-members', organizationId, access] as const,
    [access, organizationId],
  );
  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const result = await loadMembersAction({ organizationId, access });
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
