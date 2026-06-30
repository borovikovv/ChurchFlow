import { apiFetch } from '@/api/client';
import { requireServerSession } from '@/auth/session';
import { redirect } from 'next/navigation';
import type { Route } from 'next';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { PhoneInputField } from '@/components/ui/phone-input-field';

interface OrganizationRequestSummary {
  status: string;
}

async function submitOrganizationRequest(formData: FormData) {
  'use server';

  const result = await apiFetch('/organization-requests', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      organizationName: formData.get('organizationName'),
      organizationSlug: formData.get('organizationSlug'),
      contactName: formData.get('contactName'),
      contactEmail: formData.get('contactEmail'),
      contactPhone: formData.get('contactPhone'),
      message: formData.get('message'),
    }),
  });

  if (!result.ok) {
    redirect(`/organization-request?error=${encodeURIComponent(result.error.message)}` as Route);
  }

  redirect('/organization-request/status' as Route);
}

export default async function OrganizationRequestPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireServerSession('/organization-request');
  const { error } = await searchParams;
  const requests = await apiFetch<OrganizationRequestSummary[]>('/organization-requests/mine');
  if (requests.ok && requests.data.some((request) => request.status === 'PENDING')) {
    redirect('/organization-request/status' as Route);
  }

  return (
    <main className="page-content stack">
      <PageHeader
        title="Request an organization"
        description="Tell us about your organization. A platform administrator will review the request."
      />
      <div className="content-narrow stack">
        {error ? <p className="form-error">{error}</p> : null}
        <form className="form-grid" action={submitOrganizationRequest}>
          <label>
            Organization name
            <input name="organizationName" required minLength={2} maxLength={160} />
          </label>
          <label>
            Desired slug
            <input name="organizationSlug" placeholder="grace-community" maxLength={80} />
          </label>
          <label>
            Contact name
            <input name="contactName" required minLength={2} maxLength={160} />
          </label>
          <label>
            Contact email
            <input name="contactEmail" type="email" maxLength={255} />
          </label>
          <label>
            Contact phone
            <PhoneInputField name="contactPhone" />
          </label>
          <label>
            Message
            <textarea name="message" maxLength={2000} rows={5} />
          </label>
          <Button type="submit">Submit request</Button>
        </form>
      </div>
    </main>
  );
}
