import { apiFetch } from '@/api/client';
import { getCurrentUser, requireServerSession } from '@/auth/session';
import { redirect } from 'next/navigation';
import type { Route } from 'next';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { PhoneInputField } from '@/components/ui/phone-input-field';
import { DEFAULT_APP_LOCALE } from '@/i18n/locales';
import { getMessages } from '@/i18n/messages';
import { APP_ROUTES } from '@/routes';

async function submitOrganizationRequest(formData: FormData) {
  'use server';

  const result = await apiFetch<{ notificationSent: boolean }>('/organization-requests', {
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
    redirect(
      `${APP_ROUTES.organizationRequest}?error=${encodeURIComponent(result.error.message)}` as Route,
    );
  }

  const notification = result.data.notificationSent ? 'sent' : 'failed';
  redirect(
    `${APP_ROUTES.organizationRequestStatus}?submitted=1&notification=${notification}` as Route,
  );
}

export default async function OrganizationRequestPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireServerSession(APP_ROUTES.organizationRequest);
  const user = await getCurrentUser();
  if (!user) {
    redirect(
      `${APP_ROUTES.login}?redirectTo=${encodeURIComponent(APP_ROUTES.organizationRequest)}` as Route,
    );
  }
  const { error } = await searchParams;
  const messages = getMessages(user.locale ?? DEFAULT_APP_LOCALE).organizationRequest;

  return (
    <main className="page-content stack organization-request-page">
      <PageHeader title={messages.title} description={messages.description} />
      <div className="content-narrow stack">
        {error ? <p className="form-error">{error}</p> : null}
        <form className="form-grid" action={submitOrganizationRequest}>
          <label>
            {messages.organizationName}
            <input name="organizationName" required minLength={2} maxLength={160} />
          </label>
          <label>
            {messages.desiredSlug}
            <input name="organizationSlug" placeholder={messages.slugPlaceholder} maxLength={80} />
          </label>
          <label>
            {messages.contactName}
            <input name="contactName" required minLength={2} maxLength={160} />
          </label>
          <label>
            {messages.contactEmail}
            <input name="contactEmail" type="email" maxLength={255} />
          </label>
          <label>
            {messages.contactPhone}
            <PhoneInputField name="contactPhone" />
          </label>
          <label>
            {messages.message}
            <textarea name="message" maxLength={2000} rows={5} />
          </label>
          <Button type="submit">{messages.submitRequest}</Button>
        </form>
      </div>
    </main>
  );
}
