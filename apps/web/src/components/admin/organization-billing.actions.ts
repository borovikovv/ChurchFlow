'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch } from '@/api/client';
import { getCurrentUser } from '@/auth/session';
import { getMessages } from '@/i18n/messages';

export interface OrganizationBillingActionState {
  message: string | null;
  error: string | null;
}

export async function manageOrganizationBillingExemption(
  formData: FormData,
): Promise<OrganizationBillingActionState> {
  const organizationId = String(formData.get('organizationId'));
  const granting = String(formData.get('intent')) === 'grant';
  const reason = String(formData.get('reason') ?? '').trim();
  const user = await getCurrentUser();
  const messages = getMessages(user?.locale ?? 'en').adminPages;

  const result = granting
    ? await apiFetch(`/admin/organizations/${organizationId}/billing-exemption`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reason }),
      })
    : await apiFetch(`/admin/organizations/${organizationId}/billing-exemption`, {
        method: 'DELETE',
      });

  if (!result.ok) {
    return { message: null, error: result.error.message };
  }

  revalidatePath('/admin/organizations');
  revalidatePath(`/admin/organizations/${organizationId}`);

  return { message: messages.organizationDetail.billingUpdated, error: null };
}
