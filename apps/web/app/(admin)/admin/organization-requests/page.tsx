import { redirect } from 'next/navigation';
import type { Route } from 'next';

export default async function LegacyOrganizationRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const query = new URLSearchParams({ view: 'requests' });
  if (status) {
    query.set('status', status);
  }
  redirect(`/admin/organizations?${query.toString()}` as Route);
}
