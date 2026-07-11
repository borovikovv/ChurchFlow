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

export const CALENDAR_EVENT_TYPES = [
  'BIRTHDAY',
  'ANNIVERSARY',
  'TASK',
  'EVENT',
  'SERVICE',
] as const;

export const CALENDAR_EVENT_TYPE = {
  birthday: 'BIRTHDAY',
  anniversary: 'ANNIVERSARY',
  task: 'TASK',
  event: 'EVENT',
  service: 'SERVICE',
} as const;

export const CALENDAR_SERVICE_ROLES = [
  'PREACHER',
  'SERVICE_HOST',
  'WORSHIP_LEAD',
  'COMMUNION_LEAD',
] as const;

export const CALENDAR_SERVICE_ROLE = {
  preacher: 'PREACHER',
  serviceHost: 'SERVICE_HOST',
  worshipLead: 'WORSHIP_LEAD',
  communionLead: 'COMMUNION_LEAD',
} as const;

export const MEMBER_MINISTRIES = [
  'PREACHING',
  'WORSHIP',
  'DEACON',
  'MINISTER',
  'TEACHER',
  'MISSIONARY',
  'EVANGELIST',
  'CHAPLAIN',
] as const;

export const MEMBER_MINISTRY = {
  preaching: 'PREACHING',
  worship: 'WORSHIP',
  deacon: 'DEACON',
  minister: 'MINISTER',
  teacher: 'TEACHER',
  missionary: 'MISSIONARY',
  evangelist: 'EVANGELIST',
  chaplain: 'CHAPLAIN',
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
