import { z } from 'zod';
import { PhoneNumberUtil } from 'google-libphonenumber';
import {
  APP_LOCALES,
  AUDIT_ENTITY_TYPES,
  CALENDAR_EVENT_REMINDERS,
  CALENDAR_EVENT_REPEAT_PERIOD,
  CALENDAR_EVENT_REPEAT_PERIODS,
  CALENDAR_EVENT_TYPE,
  CALENDAR_EVENT_TYPES,
  CALENDAR_SERVICE_ROLES,
  BUDGET_CATEGORY_TYPES,
  BUDGET_ENTRY_FIELDS,
  BUDGET_GROUPS,
  DEFAULT_MEMBER_PAGE_SIZE,
  MEMBER_MINISTRIES,
  MEMBER_TABS,
  MEMBER_PAGE_SIZE_OPTIONS,
  MEMBER_CSV_TEMPLATE_COLUMNS,
  NOTIFICATION_TYPES,
  DEFAULT_PRAYER_REQUEST_PAGE_SIZE,
  PRAYER_REQUEST_PAGE_SIZE_OPTIONS,
  PRAYER_REQUEST_TABS,
  PUBLIC_SECTION_TYPES,
} from './constants.js';

const DEFAULT_PHONE_REGION = 'UA';
const phoneNumberUtil = PhoneNumberUtil.getInstance();

export const uuidSchema = z.string().uuid();
export const slugSchema = z
  .string()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const authProviderSchema = z.enum(['telegram']);
export const invitationTargetProviderSchema = z.enum([
  'telegram',
  'email',
  'phone',
  'google',
  'apple',
]);
export const invitationModeSchema = z.enum(['targeted_telegram', 'claimable_link']);

export const platformRoleSchema = z.enum(['USER', 'ADMIN', 'SUPER_ADMIN']);
export const organizationRoleSchema = z.enum(['OWNER', 'ADMIN', 'MEMBER', 'VIEWER']);
export const organizationStatusSchema = z.enum(['ACTIVE', 'SUSPENDED', 'ARCHIVED', 'DELETED']);
export const organizationMemberStatusSchema = z.enum([
  'ACTIVE',
  'SUSPENDED',
  'ARCHIVED',
  'REMOVED',
]);
export const updateOrganizationMemberRoleSchema = z.object({
  role: organizationRoleSchema,
});
export const organizationMemberAccountStateSchema = z.enum([
  'UNCLAIMED',
  'CLAIM_PENDING',
  'CLAIM_REQUESTED',
  'CLAIMED',
  'ACCOUNT_DISABLED',
]);
export const organizationMembersAccessFilterSchema = z.enum([
  'all',
  'connected',
  'offline',
  'requested',
  'suspended',
]);
export const organizationMembersTypeFilterSchema = z.enum(['all', 'member', 'visitor']);
export const organizationMembersTabSchema = z.enum(MEMBER_TABS);
export const memberMinistrySchema = z.enum(MEMBER_MINISTRIES);
export const memberMinistriesSchema = z.array(memberMinistrySchema);

const memberMinistriesQuerySchema = z.preprocess((value) => {
  if (Array.isArray(value)) return value.flatMap((item) => String(item).split(','));
  if (typeof value === 'string') return value.split(',').filter(Boolean);
  return value;
}, memberMinistriesSchema.default([]));

export const listOrganizationMembersQuerySchema = z.object({
  access: organizationMembersAccessFilterSchema.default('all'),
  membershipId: uuidSchema.optional(),
  tab: organizationMembersTabSchema.default('active'),
  type: organizationMembersTypeFilterSchema.default('all'),
  search: z.string().trim().max(100).default(''),
  ministries: memberMinistriesQuerySchema,
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .refine(
      (value): value is (typeof MEMBER_PAGE_SIZE_OPTIONS)[number] =>
        MEMBER_PAGE_SIZE_OPTIONS.includes(value as (typeof MEMBER_PAGE_SIZE_OPTIONS)[number]),
      { message: 'Page size must be 10, 25, or 50' },
    )
    .default(DEFAULT_MEMBER_PAGE_SIZE),
});
export const calendarEventTypeSchema = z.enum(CALENDAR_EVENT_TYPES);
export const calendarEventReminderSchema = z.enum(CALENDAR_EVENT_REMINDERS);
export const calendarEventRepeatPeriodSchema = z.enum(CALENDAR_EVENT_REPEAT_PERIODS);
export const calendarEventTypesSchema = z.array(calendarEventTypeSchema);
export const calendarServiceRoleSchema = z.enum(CALENDAR_SERVICE_ROLES);
export const membershipSourceSchema = z.enum([
  'EXISTING',
  'MANUAL',
  'INVITATION',
  'ORGANIZATION_APPROVAL',
]);
export const organizationRequestStatusSchema = z.enum([
  'PENDING',
  'APPROVED',
  'REJECTED',
  'EXPIRED',
]);
export const adminOrganizationWorkspaceViewSchema = z.enum(['all', 'mine']);
export const adminOrganizationWorkspaceStatusSchema = z.enum([
  'ACTIVE',
  'SUSPENDED',
  'ARCHIVED',
  'DELETED',
  'PENDING',
  'REJECTED',
  'EXPIRED',
]);
export const listAdminOrganizationWorkspaceQuerySchema = z.object({
  view: adminOrganizationWorkspaceViewSchema.optional(),
  status: adminOrganizationWorkspaceStatusSchema.optional(),
});

const optionalTrimmedString = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value === '' ? undefined : value));

const nullableTrimmedString = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((value) => (value === '' ? null : value));

const nullableEmail = nullableTrimmedString(255)
  .refine(isNullableEmail, { message: 'Invalid email' })
  .transform((value) => value?.toLowerCase() ?? value);

const nullablePhoneNumber = nullableTrimmedString(40).refine(isNullablePhoneNumber, {
  message: 'Invalid phone number',
});

const nullablePastOrTodayDate = z
  .string()
  .date()
  .nullable()
  .optional()
  .refine((value) => value == null || value <= new Date().toISOString().slice(0, 10), {
    message: 'Date cannot be in the future',
  });

function isNullableEmail(value: string | null | undefined): boolean {
  return value === undefined || value === null || z.string().email().safeParse(value).success;
}

function isNullablePhoneNumber(value: string | null | undefined): boolean {
  if (value === undefined || value === null) return true;

  try {
    const parsed = phoneNumberUtil.parseAndKeepRawInput(
      value,
      value.startsWith('+') ? undefined : DEFAULT_PHONE_REGION,
    );

    return phoneNumberUtil.isValidNumber(parsed);
  } catch {
    return false;
  }
}

const dateTimeStringSchema = z.string().datetime({ offset: true });

const calendarEventTypesQuerySchema = z.preprocess((value) => {
  if (Array.isArray(value)) return value.flatMap((item) => String(item).split(','));
  if (typeof value === 'string') return value.split(',').filter(Boolean);
  return value;
}, calendarEventTypesSchema.optional());

export const listCalendarEventsQuerySchema = z
  .object({
    rangeStart: dateTimeStringSchema,
    rangeEnd: dateTimeStringSchema,
    types: calendarEventTypesQuerySchema,
  })
  .refine((value) => new Date(value.rangeStart) < new Date(value.rangeEnd), {
    path: ['rangeEnd'],
    message: 'Range end must be after range start',
  });

export const updateCalendarPreferencesSchema = z.object({
  visibleEventTypes: calendarEventTypesSchema,
});

export const notificationTypeSchema = z.enum(NOTIFICATION_TYPES);

export const budgetGroupSchema = z.enum(BUDGET_GROUPS);
export const budgetCategoryTypeSchema = z.enum(BUDGET_CATEGORY_TYPES);
export const budgetEntryFieldSchema = z.enum(BUDGET_ENTRY_FIELDS);
const budgetAmountSchema = z.coerce.number().min(0).max(999_999_999.99);

export const listBudgetQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
});

export const createBudgetMonthSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});

export const createBudgetCategorySchema = z.object({
  group: budgetGroupSchema,
  type: budgetCategoryTypeSchema,
  name: z.string().trim().min(1).max(120),
});

export const updateBudgetCategorySchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  type: budgetCategoryTypeSchema.optional(),
  order: z.coerce.number().int().min(0).max(1000).optional(),
});

export const updateBudgetEntrySchema = z
  .object({
    amountUah: budgetAmountSchema.optional(),
    amountUsd: budgetAmountSchema.optional(),
    amountEur: budgetAmountSchema.optional(),
  })
  .refine(
    (value) =>
      value.amountUah !== undefined ||
      value.amountUsd !== undefined ||
      value.amountEur !== undefined,
    { message: 'At least one budget entry field is required' },
  );

export const updateBudgetEntryNoteSchema = z.object({
  note: z.string().trim().max(500).nullable(),
});

export const updateBudgetOpeningBalanceSchema = z.object({
  sinceYear: z.coerce.number().int().min(2000).max(2100),
  amountUah: budgetAmountSchema,
  amountUsd: budgetAmountSchema,
  amountEur: budgetAmountSchema,
});

export const listNotificationsQuerySchema = z.object({
  cursor: uuidSchema.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const notificationListItemSchema = z.object({
  id: uuidSchema,
  organizationId: uuidSchema,
  type: notificationTypeSchema,
  title: z.string(),
  body: z.string().nullable(),
  url: z.string().nullable(),
  entityType: z.string().nullable(),
  entityId: uuidSchema.nullable(),
  readAt: z.string().datetime({ offset: true }).nullable(),
  createdAt: z.string().datetime({ offset: true }),
});

export const notificationCalendarEventDetailSchema = z.object({
  id: uuidSchema,
  type: calendarEventTypeSchema,
  title: z.string(),
  description: z.string().nullable(),
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }).nullable(),
  allDay: z.boolean(),
  assignees: z.array(
    z.object({
      id: uuidSchema,
      displayName: z.string(),
    }),
  ),
  participants: z.array(
    z.object({
      role: calendarServiceRoleSchema,
      displayName: z.string(),
    }),
  ),
});

export const notificationDetailSchema = notificationListItemSchema.extend({
  calendarEvent: notificationCalendarEventDetailSchema.nullable(),
});

export const notificationsPageSchema = z.object({
  items: z.array(notificationListItemSchema),
  nextCursor: z.string().nullable(),
  unreadCount: z.number().int().min(0),
});

export const notificationsSummarySchema = z.object({
  unreadCount: z.number().int().min(0),
  recentItems: z.array(notificationListItemSchema),
});

export const updateNotificationPreferencesSchema = z.object({
  inAppEnabled: z.boolean(),
  emailEnabled: z.boolean(),
  telegramEnabled: z.boolean(),
  taskAssignedEnabled: z.boolean(),
  serviceAssignedEnabled: z.boolean(),
  remindersEnabled: z.boolean(),
  birthdayDigestEnabled: z.boolean(),
  organizationUpdatesEnabled: z.boolean(),
  timeZone: z.string().trim().min(1).max(64).nullable().optional(),
});

export const notificationPreferencesSchema = updateNotificationPreferencesSchema.extend({
  telegram: z.object({
    connected: z.boolean(),
    enabled: z.boolean(),
    username: z.string().nullable(),
    blockedAt: z.string().datetime({ offset: true }).nullable(),
    revokedAt: z.string().datetime({ offset: true }).nullable(),
  }),
});

export const telegramNotificationLinkSchema = z.object({
  url: z.string().url(),
  expiresAt: z.string().datetime({ offset: true }),
});

export const telegramNotificationDisconnectSchema = z.object({
  telegram: notificationPreferencesSchema.shape.telegram,
});

const calendarServicePersonInputSchema = z
  .object({
    membershipId: uuidSchema.optional(),
    customName: optionalTrimmedString(160),
  })
  .superRefine((value, ctx) => {
    const hasMembership = Boolean(value.membershipId);
    const hasCustomName = Boolean(value.customName);
    if (hasMembership === hasCustomName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Select a member or enter a guest name',
      });
    }
  });

const optionalCalendarServicePersonInputSchema = z
  .object({
    membershipId: uuidSchema.optional(),
    customName: optionalTrimmedString(160),
  })
  .superRefine((value, ctx) => {
    const hasMembership = Boolean(value.membershipId);
    const hasCustomName = Boolean(value.customName);
    if (hasMembership && hasCustomName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Select a member or enter a guest name, not both',
      });
    }
  })
  .transform((value) => {
    if (!value.membershipId && !value.customName) return undefined;
    return value;
  });

const calendarServiceDetailsInputSchema = z
  .object({
    preacher: calendarServicePersonInputSchema.optional(),
    serviceHost: optionalCalendarServicePersonInputSchema.optional(),
    worshipLead: calendarServicePersonInputSchema.optional(),
    hasCommunion: z.boolean().default(false),
    communionLead: calendarServicePersonInputSchema.optional(),
    biblePassage: nullableTrimmedString(180),
    songs: z.array(z.string().trim().min(1).max(180)).default([]),
  })
  .superRefine((value, ctx) => {
    if (value.hasCommunion && !value.communionLead) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['communionLead'],
        message: 'Communion lead is required when communion is enabled',
      });
    }
  });

const calendarEventInputSchema = z.object({
  type: calendarEventTypeSchema,
  title: z.string().trim().min(1).max(180),
  description: nullableTrimmedString(3000),
  startsAt: dateTimeStringSchema,
  endsAt: dateTimeStringSchema.nullable().optional(),
  allDay: z.boolean().default(false),
  reminder: calendarEventReminderSchema.nullable().optional(),
  repeatPeriod: calendarEventRepeatPeriodSchema.default(CALENDAR_EVENT_REPEAT_PERIOD.none),
  linkedMembershipId: uuidSchema.nullable().optional(),
  imageAssetId: uuidSchema.nullable().optional(),
  assigneeMembershipIds: z.array(uuidSchema).default([]),
  taskCompleted: z.boolean().default(false),
  serviceDetails: calendarServiceDetailsInputSchema.optional(),
});

function refineCalendarEventInput(
  value:
    | z.infer<typeof calendarEventInputSchema>
    | z.infer<ReturnType<typeof calendarEventInputSchema.partial>>,
  ctx: z.RefinementCtx,
) {
  if (value.startsAt && value.endsAt && new Date(value.startsAt) > new Date(value.endsAt)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['endsAt'],
      message: 'End time must be after start time',
    });
  }

  if (value.type === CALENDAR_EVENT_TYPE.task && value.assigneeMembershipIds?.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['assigneeMembershipIds'],
      message: 'Task events require at least one assignee',
    });
  }

  if (value.type === CALENDAR_EVENT_TYPE.service && !value.serviceDetails) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['serviceDetails'],
      message: 'Service events require service details',
    });
  }

  if (value.type && value.type !== CALENDAR_EVENT_TYPE.service && value.serviceDetails) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['serviceDetails'],
      message: 'Only service events can include service details',
    });
  }
}

export const createCalendarEventSchema =
  calendarEventInputSchema.superRefine(refineCalendarEventInput);

export const updateCalendarEventSchema = calendarEventInputSchema
  .partial()
  .superRefine(refineCalendarEventInput)
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'At least one event field is required',
  });

export const toggleCalendarTaskCompletionSchema = z.object({
  completed: z.boolean(),
});

export const prayerRequestTabSchema = z.enum(PRAYER_REQUEST_TABS);

export const listPrayerRequestsQuerySchema = z.object({
  tab: prayerRequestTabSchema.default('active'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .refine(
      (value): value is (typeof PRAYER_REQUEST_PAGE_SIZE_OPTIONS)[number] =>
        PRAYER_REQUEST_PAGE_SIZE_OPTIONS.includes(
          value as (typeof PRAYER_REQUEST_PAGE_SIZE_OPTIONS)[number],
        ),
      { message: 'Page size must be 10, 25, or 50' },
    )
    .default(DEFAULT_PRAYER_REQUEST_PAGE_SIZE),
});

export const createPrayerRequestSchema = z.object({
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().min(2).max(5000),
});

export const updatePrayerRequestSchema = z
  .object({
    title: z.string().trim().min(2).max(160).optional(),
    description: z.string().trim().min(2).max(5000).optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'At least one prayer request field is required',
  });

export const archivePrayerRequestSchema = z.object({
  archiveReason: nullableTrimmedString(1000),
});

export const appLocaleSchema = z.enum(APP_LOCALES);

export const updateCurrentUserProfileSchema = z
  .object({
    displayName: nullableTrimmedString(160).refine(
      (value) => value === undefined || value === null || value.length >= 2,
      { message: 'Name must be at least 2 characters' },
    ),
    email: nullableEmail,
    baptizedAt: nullablePastOrTodayDate,
    baptismChurchName: nullableTrimmedString(160),
    locale: appLocaleSchema.optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'At least one profile field is required',
  });

export const organizationMemberRelationshipTypeSchema = z.enum([
  'SPOUSE',
  'PARENT',
  'CHILD',
  'SIBLING',
  'OTHER',
]);

export const createOrganizationMemberRelationshipSchema = z.object({
  relatedMembershipId: uuidSchema,
  type: organizationMemberRelationshipTypeSchema,
  notes: nullableTrimmedString(1000),
});

export const createMemberPhotoUploadSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  byteSize: z
    .number()
    .int()
    .positive()
    .max(5 * 1024 * 1024),
});

export const confirmMemberPhotoUploadSchema = z.object({ assetId: uuidSchema });

export const createManualOrganizationMemberSchema = z.object({
  displayName: z.string().trim().min(2).max(160),
  email: nullableEmail,
  phone: nullablePhoneNumber,
  notes: nullableTrimmedString(2000),
  memberSince: nullablePastOrTodayDate,
  birthday: nullablePastOrTodayDate,
  anniversary: nullablePastOrTodayDate,
  biography: nullableTrimmedString(5000),
  familyNotes: nullableTrimmedString(3000),
  role: z.enum(['MEMBER', 'VIEWER']).default('MEMBER'),
  ministries: memberMinistriesSchema.optional(),
});

export const importOrganizationMembersCsvResultSchema = z.object({
  createdCount: z.number().int().min(0),
  failedCount: z.number().int().min(0),
  totalRows: z.number().int().min(0),
  errors: z.array(
    z.object({
      row: z.number().int().min(1),
      field: z.enum(MEMBER_CSV_TEMPLATE_COLUMNS).nullable(),
      message: z.string(),
    }),
  ),
  members: z.array(
    z.object({
      id: uuidSchema,
      role: organizationRoleSchema,
      source: membershipSourceSchema,
      ministries: memberMinistriesSchema,
      profile: z.object({
        displayName: z.string(),
        email: z.string().nullable(),
        phone: z.string().nullable(),
        birthday: z.string().nullable(),
        anniversary: z.string().nullable(),
      }),
    }),
  ),
});

export const updateOrganizationMemberProfileSchema = z
  .object({
    displayName: z.string().trim().min(2).max(160).optional(),
    email: nullableEmail,
    phone: nullablePhoneNumber,
    notes: nullableTrimmedString(2000),
    memberSince: nullablePastOrTodayDate,
    birthday: nullablePastOrTodayDate,
    anniversary: nullablePastOrTodayDate,
    biography: nullableTrimmedString(5000),
    familyNotes: nullableTrimmedString(3000),
    ministries: memberMinistriesSchema.optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'At least one profile field is required',
  });

export const membershipClaimTokenSchema = z.object({
  token: z.string().min(32).max(512),
});

export const organizationSchema = z.object({
  id: uuidSchema,
  name: z.string().min(1).max(160),
  slug: slugSchema,
  description: z.string().max(500).nullable(),
  status: organizationStatusSchema.default('ACTIVE'),
});

export const createOrganizationSchema = z.object({
  name: z.string().trim().min(1).max(160),
  slug: slugSchema,
  description: z.string().max(500).optional(),
});

export const updateOrganizationSchema = z
  .object({
    name: z.string().trim().min(1).max(160).optional(),
    slug: slugSchema.optional(),
    description: nullableTrimmedString(500),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'At least one organization field is required',
  });

export const listAuditLogsQuerySchema = z.object({
  cursor: uuidSchema.optional(),
  entityType: z.enum(AUDIT_ENTITY_TYPES).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export const auditLogActorSchema = z.object({
  id: uuidSchema,
  displayName: z.string().nullable(),
  email: z.string().nullable(),
  avatarUrl: z.string().nullable(),
});

export const auditLogListItemSchema = z.object({
  id: uuidSchema,
  organizationId: uuidSchema.nullable(),
  actorUserId: uuidSchema.nullable(),
  action: z.string(),
  entityType: z.string(),
  entityId: uuidSchema.nullable(),
  metadata: z.record(z.unknown()),
  createdAt: z.string().datetime({ offset: true }),
  actor: auditLogActorSchema.nullable(),
});

export const auditLogsPageSchema = z.object({
  items: z.array(auditLogListItemSchema),
  nextCursor: uuidSchema.nullable(),
});

export const createOrganizationRequestSchema = z.object({
  organizationName: z.string().trim().min(2).max(160),
  organizationSlug: optionalTrimmedString(80).refine(
    (value) => value === undefined || slugSchema.safeParse(value).success,
    {
      message: 'Invalid organization slug',
    },
  ),
  contactName: z.string().trim().min(2).max(160),
  contactEmail: optionalTrimmedString(255)
    .refine((value) => value === undefined || z.string().email().safeParse(value).success, {
      message: 'Invalid email',
    })
    .transform((value) => value?.toLowerCase()),
  contactPhone: optionalTrimmedString(40),
  message: optionalTrimmedString(2000),
});

export const approveOrganizationRequestSchema = z.object({
  organizationSlug: slugSchema.optional(),
  organizationName: z.string().trim().min(2).max(160).optional(),
});

export const rejectOrganizationRequestSchema = z.object({
  rejectionReason: z.string().trim().min(2).max(1000),
});

export const createOrganizationInvitationSchema = z
  .object({
    mode: invitationModeSchema.default('claimable_link'),
    targetProvider: invitationTargetProviderSchema.optional(),
    targetProviderAccountId: optionalTrimmedString(255),
    targetDisplay: optionalTrimmedString(255),
    email: optionalTrimmedString(255)
      .refine((value) => value === undefined || z.string().email().safeParse(value).success, {
        message: 'Invalid email',
      })
      .transform((value) => value?.toLowerCase()),
    role: organizationRoleSchema.default('MEMBER'),
  })
  .superRefine((value, ctx) => {
    if (value.mode === 'targeted_telegram') {
      if (value.targetProvider !== 'telegram') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['targetProvider'],
          message: 'Targeted invitations must use Telegram identity',
        });
      }

      if (!value.targetProviderAccountId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['targetProviderAccountId'],
          message: 'Targeted invitations require Telegram provider account id',
        });
      }
    }

    if (value.mode === 'claimable_link') {
      if (value.role === 'OWNER' || value.role === 'ADMIN') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['role'],
          message: 'Claimable links are allowed only for MEMBER and VIEWER roles',
        });
      }

      if (value.targetProvider || value.targetProviderAccountId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['targetProviderAccountId'],
          message: 'Claimable links must not be pre-bound to a provider account',
        });
      }
    }
  });

export const acceptInvitationSchema = z.object({
  token: z.string().min(32).max(512),
});

export const invitationTokenQuerySchema = z.object({
  token: z.string().min(32).max(512),
});

export const organizationWebsiteSchema = z.object({
  id: uuidSchema,
  organizationId: uuidSchema,
  title: z.string().min(1).max(160),
  description: z.string().max(500).nullable(),
  publishedAt: z.coerce.date().nullable(),
});

export const updateWebsiteSettingsSchema = z.object({
  title: z.string().min(1).max(160),
  description: z.string().max(500).optional(),
  theme: z.record(z.unknown()).default({}),
  settings: z.record(z.unknown()).default({}),
});

export const pageStatusSchema = z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']);

export const websitePageSchema = z.object({
  id: uuidSchema,
  organizationId: uuidSchema,
  websiteId: uuidSchema,
  slug: slugSchema,
  title: z.string().min(1).max(160),
  status: pageStatusSchema,
});

export const upsertWebsitePageSchema = z.object({
  slug: slugSchema,
  title: z.string().min(1).max(160),
  status: pageStatusSchema.default('DRAFT'),
  seo: z.record(z.unknown()).default({}),
});

export const sectionTypeSchema = z.enum(PUBLIC_SECTION_TYPES);

export const websiteSectionSchema = z.object({
  id: uuidSchema,
  organizationId: uuidSchema,
  pageId: uuidSchema,
  type: sectionTypeSchema,
  order: z.number().int().min(0),
  content: z.record(z.unknown()),
});

export const upsertWebsiteSectionSchema = z.object({
  type: sectionTypeSchema,
  order: z.number().int().min(0),
  content: z.record(z.unknown()).default({}),
});

export const publishWebsiteSchema = z.object({
  published: z.boolean(),
});

export const publishWebsitePageSchema = z.object({
  published: z.boolean(),
});

export const reorderWebsiteSectionsSchema = z.object({
  sectionIds: z.array(uuidSchema).min(1),
});

export const mediaAssetSchema = z.object({
  id: uuidSchema,
  organizationId: uuidSchema,
  filename: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(120),
  byteSize: z.bigint().nonnegative(),
  altText: z.string().max(300).nullable(),
});

export const paginationQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
