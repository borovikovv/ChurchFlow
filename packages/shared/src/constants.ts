export const AUTH_COOKIE_NAMES = {
  access: 'churchflow_access',
  refresh: 'churchflow_refresh',
} as const;

export const APP_LOCALES = ['en', 'uk'] as const;
export const DEFAULT_APP_LOCALE = 'en';

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

export const CALENDAR_SERVICE_ROLE_LABELS = {
  PREACHER: 'Preacher',
  SERVICE_HOST: 'Host',
  WORSHIP_LEAD: 'Worship',
  COMMUNION_LEAD: 'Communion',
} as const satisfies Record<(typeof CALENDAR_SERVICE_ROLES)[number], string>;

export const CALENDAR_SERVICE_ROLE_LABELS_BY_LOCALE = {
  en: CALENDAR_SERVICE_ROLE_LABELS,
  uk: {
    PREACHER: 'Проповідник',
    SERVICE_HOST: 'Ведучий',
    WORSHIP_LEAD: 'Прославлення',
    COMMUNION_LEAD: 'Причастя',
  },
} as const satisfies Record<
  (typeof APP_LOCALES)[number],
  Record<(typeof CALENDAR_SERVICE_ROLES)[number], string>
>;

export const NOTIFICATION_TYPES = [
  'TASK_ASSIGNED',
  'TASK_UPDATED',
  'TASK_DUE_REMINDER',
  'CALENDAR_EVENT_LINKED',
  'CALENDAR_EVENT_REMINDER',
  'SERVICE_ASSIGNED',
  'SERVICE_REMINDER',
  'MEMBER_ADDED',
  'MEMBER_REMOVED',
  'ORGANIZATION_REQUEST_CREATED',
  'PRAYER_REQUEST_CREATED',
  'BIRTHDAY_DIGEST',
  'ORGANIZATION_ANNOUNCEMENT',
] as const;

export const PRAYER_REQUEST_TABS = ['active', 'archived'] as const;

export const DEFAULT_PRAYER_REQUEST_PAGE_SIZE = 10;

export const PRAYER_REQUEST_PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

export const BUDGET_GROUPS = [
  'INCOME',
  'CURRENCY_EXCHANGE',
  'FACILITY',
  'TABLES',
  'PASTORS',
  'DISCIPLESHIP',
  'EVANGELISM',
  'OTHER',
] as const;

export const BUDGET_GROUP = {
  income: 'INCOME',
  currencyExchange: 'CURRENCY_EXCHANGE',
  facility: 'FACILITY',
  tables: 'TABLES',
  pastors: 'PASTORS',
  discipleship: 'DISCIPLESHIP',
  evangelism: 'EVANGELISM',
  other: 'OTHER',
} as const;

export const BUDGET_CATEGORY_TYPES = ['INCOME', 'EXPENSE'] as const;

export const BUDGET_CATEGORY_TYPE = {
  income: 'INCOME',
  expense: 'EXPENSE',
} as const;

export const BUDGET_CURRENCIES = ['UAH', 'USD', 'EUR'] as const;

export const BUDGET_ENTRY_FIELDS = ['AMOUNT_UAH', 'AMOUNT_USD', 'AMOUNT_EUR'] as const;

export const BUDGET_ENTRY_FIELD = {
  amountUah: 'AMOUNT_UAH',
  amountUsd: 'AMOUNT_USD',
  amountEur: 'AMOUNT_EUR',
} as const;

export const DEFAULT_BUDGET_MONTH_ROW_COUNT = 10;

export const BUDGET_MONTH_ROW_COUNT = DEFAULT_BUDGET_MONTH_ROW_COUNT;

export const DEFAULT_BUDGET_CATEGORIES = [
  {
    group: BUDGET_GROUP.income,
    type: BUDGET_CATEGORY_TYPE.income,
    name: 'Office rent income',
  },
  {
    group: BUDGET_GROUP.income,
    type: BUDGET_CATEGORY_TYPE.income,
    name: 'Offerings and donations',
  },
  { group: BUDGET_GROUP.income, type: BUDGET_CATEGORY_TYPE.income, name: 'USD income' },
  { group: BUDGET_GROUP.income, type: BUDGET_CATEGORY_TYPE.income, name: 'EUR income' },
  {
    group: BUDGET_GROUP.currencyExchange,
    type: BUDGET_CATEGORY_TYPE.income,
    name: 'UAH from exchange',
  },
  {
    group: BUDGET_GROUP.currencyExchange,
    type: BUDGET_CATEGORY_TYPE.expense,
    name: 'USD spent',
  },
  {
    group: BUDGET_GROUP.currencyExchange,
    type: BUDGET_CATEGORY_TYPE.expense,
    name: 'EUR spent',
  },
  {
    group: BUDGET_GROUP.facility,
    type: BUDGET_CATEGORY_TYPE.expense,
    name: 'Rent, utilities and cleaning',
  },
  { group: BUDGET_GROUP.facility, type: BUDGET_CATEGORY_TYPE.expense, name: 'Inventory' },
  {
    group: BUDGET_GROUP.facility,
    type: BUDGET_CATEGORY_TYPE.expense,
    name: 'Household supplies',
  },
  { group: BUDGET_GROUP.tables, type: BUDGET_CATEGORY_TYPE.expense, name: 'Sunday groceries' },
  { group: BUDGET_GROUP.tables, type: BUDGET_CATEGORY_TYPE.expense, name: 'Holidays' },
  {
    group: BUDGET_GROUP.pastors,
    type: BUDGET_CATEGORY_TYPE.expense,
    name: 'Guest ministers expenses',
  },
  {
    group: BUDGET_GROUP.pastors,
    type: BUDGET_CATEGORY_TYPE.expense,
    name: 'Minister support',
  },
  { group: BUDGET_GROUP.discipleship, type: BUDGET_CATEGORY_TYPE.expense, name: 'Groups' },
  { group: BUDGET_GROUP.discipleship, type: BUDGET_CATEGORY_TYPE.expense, name: 'Catechesis' },
  { group: BUDGET_GROUP.evangelism, type: BUDGET_CATEGORY_TYPE.expense, name: 'Game nights' },
  { group: BUDGET_GROUP.other, type: BUDGET_CATEGORY_TYPE.expense, name: 'Other expenses' },
] as const;

export const MEMBER_MINISTRIES = [
  'PREACHING',
  'WORSHIP',
  'DEACON',
  'MINISTER',
  'TEACHER',
  'MISSIONARY',
  'EVANGELIST',
  'CHAPLAIN',
  'CHILDREN',
  'YOUTH',
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
  children: 'CHILDREN',
  youth: 'YOUTH',
} as const;

export const MEMBER_PAGE_SIZE_OPTIONS = [10, 25, 50] as const;
export const DEFAULT_MEMBER_PAGE_SIZE = 10;
export const MEMBER_TABS = ['active', 'archived'] as const;

export const MEMBER_CSV_TEMPLATE_COLUMNS = [
  'displayName',
  'email',
  'phone',
  'role',
  'ministries',
  'memberSince',
  'birthday',
  'anniversary',
  'notes',
  'biography',
  'familyNotes',
] as const;

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
