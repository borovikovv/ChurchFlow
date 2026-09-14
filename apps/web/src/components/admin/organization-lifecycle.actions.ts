'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch } from '@/api/client';
import { getCurrentUser } from '@/auth/session';
import { getMessages } from '@/i18n/messages';

export interface OrganizationLifecycleActionState {
  message: string | null;
  error: string | null;
}

const LIFECYCLE_ACTIONS = ['restore', 'suspend', 'archive', 'delete-soft'] as const;

type LifecycleAction = (typeof LIFECYCLE_ACTIONS)[number];

function isLifecycleAction(value: string): value is LifecycleAction {
  return LIFECYCLE_ACTIONS.includes(value as LifecycleAction);
}

export async function manageOrganizationLifecycle(
  formData: FormData,
): Promise<OrganizationLifecycleActionState> {
  const organizationId = String(formData.get('organizationId'));
  const action = String(formData.get('action'));
  const user = await getCurrentUser();
  const messages = getMessages(user?.locale ?? 'en').adminPages;

  if (!isLifecycleAction(action)) {
    return { message: null, error: messages.organizationDetail.unknownAction };
  }

  const result = await apiFetch(`/admin/organizations/${organizationId}/${action}`, {
    method: 'POST',
  });

  if (!result.ok) {
    return { message: null, error: result.error.message };
  }

  revalidatePath('/admin/organizations');
  revalidatePath(`/admin/organizations/${organizationId}`);

  return { message: messages.organizationDetail.statusUpdated, error: null };
}
