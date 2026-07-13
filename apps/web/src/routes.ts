import type { Route } from 'next';

export const APP_ROUTES = {
  home: '/',
  adminOrganizations: '/admin/organizations',
  login: '/login',
  memberClaimsStatus: '/member-claims/status',
  organizationRequest: '/organization-request',
  organizationRequestStatus: '/organization-request/status',
  organizationSelect: '/organizations/select',
  profile: '/profile',
} as const satisfies Record<string, Route>;
