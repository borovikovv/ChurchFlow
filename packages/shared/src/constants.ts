export const AUTH_COOKIE_NAMES = {
  access: '__Host-churchflow_access',
  refresh: '__Host-churchflow_refresh'
} as const;

export const ORG_PERMISSIONS = {
  membersManage: 'members.manage',
  websiteManage: 'website.manage',
  mediaManage: 'media.manage',
  billingManage: 'billing.manage'
} as const;

export const PUBLIC_SECTION_TYPES = ['hero', 'about', 'schedule', 'gallery', 'contact'] as const;
