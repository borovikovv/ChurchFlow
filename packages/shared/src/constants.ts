export const AUTH_COOKIE_NAMES = {
  access: 'churchflow_access',
  refresh: 'churchflow_refresh',
} as const;

export const ORG_PERMISSIONS = {
  membersManage: 'members.manage',
  websiteManage: 'website.manage',
  mediaManage: 'media.manage',
  billingManage: 'billing.manage',
} as const;

export const PUBLIC_SECTION_TYPES = ['hero', 'about', 'schedule', 'gallery', 'contact'] as const;

export const CALENDAR_EVENT_TYPES = ['BIRTHDAY', 'ANNIVERSARY', 'TASK', 'EVENT'] as const;

export const CALENDAR_EVENT_TYPE = {
  birthday: 'BIRTHDAY',
  anniversary: 'ANNIVERSARY',
  task: 'TASK',
  event: 'EVENT',
} as const;

export const CALENDAR_EVENT_REMINDERS = ['ONE_HOUR', 'ONE_DAY', 'ONE_WEEK'] as const;

export const CALENDAR_EVENT_REPEAT_PERIODS = [
  'NONE',
  'DAILY',
  'WEEKLY',
  'MONTHLY',
  'YEARLY',
] as const;

export const CALENDAR_EVENT_REPEAT_PERIOD = {
  none: 'NONE',
  daily: 'DAILY',
  weekly: 'WEEKLY',
  monthly: 'MONTHLY',
  yearly: 'YEARLY',
} as const;

export const DEFAULT_CALENDAR_VISIBLE_EVENT_TYPES = CALENDAR_EVENT_TYPES;
