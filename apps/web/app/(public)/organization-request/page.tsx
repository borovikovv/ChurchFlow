import { apiFetch } from '@/api/client';
import { requireServerSession } from '@/auth/session';

async function submitOrganizationRequest(formData: FormData) {
  'use server';

  await apiFetch('/organization-requests', {
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
}

export default async function OrganizationRequestPage() {
  await requireServerSession('/organization-request');

  return (
    <main className="section">
      <div className="shell stack grid-center">
        <h1>Request organization access</h1>
        <form className="form-grid max-w-130 w-full" action={submitOrganizationRequest}>
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
            <input name="contactPhone" maxLength={40} />
          </label>
          <label>
            Message
            <textarea name="message" maxLength={2000} rows={5} />
          </label>
          <button className="button" type="submit">
            Submit request
          </button>
        </form>
      </div>
    </main>
  );
}
