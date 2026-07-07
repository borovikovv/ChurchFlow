import type { Route } from 'next';

export const APP_ROUTES = {
  home: '/',
  adminOrganizations: '/admin/organizations',
  login: '/login',
  organizationRequest: '/organization-request',
  organizationRequestStatus: '/organization-request/status',
  profile: '/profile',
} as const satisfies Record<string, Route>;
