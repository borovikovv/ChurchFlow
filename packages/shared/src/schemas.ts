import { z } from 'zod';
import {
  CALENDAR_EVENT_REMINDERS,
  CALENDAR_EVENT_REPEAT_PERIOD,
  CALENDAR_EVENT_REPEAT_PERIODS,
  CALENDAR_EVENT_TYPE,
  CALENDAR_EVENT_TYPES,
  CALENDAR_SERVICE_ROLES,
  MEMBER_MINISTRIES,
  PUBLIC_SECTION_TYPES,
} from './constants.js';

export const uuidSchema = z.string().uuid();
export const slugSchema = z
  .string()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const jwtPayloadSchema = z.object({
  sub: uuidSchema,
  sid: uuidSchema,
  type: z.enum(['access', 'refresh']),
});

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
export const organizationMemberStatusSchema = z.enum(['ACTIVE', 'SUSPENDED', 'REMOVED']);
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
export const listOrganizationMembersQuerySchema = z.object({
  access: organizationMembersAccessFilterSchema.default('all'),
});
export const calendarEventTypeSchema = z.enum(CALENDAR_EVENT_TYPES);
export const calendarEventReminderSchema = z.enum(CALENDAR_EVENT_REMINDERS);
export const calendarEventRepeatPeriodSchema = z.enum(CALENDAR_EVENT_REPEAT_PERIODS);
export const calendarEventTypesSchema = z.array(calendarEventTypeSchema);
export const calendarServiceRoleSchema = z.enum(CALENDAR_SERVICE_ROLES);
export const memberMinistrySchema = z.enum(MEMBER_MINISTRIES);
export const memberMinistriesSchema = z.array(memberMinistrySchema);
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

const nullablePastOrTodayDate = z
  .string()
  .date()
  .nullable()
  .optional()
  .refine((value) => value == null || value <= new Date().toISOString().slice(0, 10), {
    message: 'Date cannot be in the future',
  });

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

export const updateCurrentUserProfileSchema = z
  .object({
    baptizedAt: nullablePastOrTodayDate,
    baptismChurchName: nullableTrimmedString(160),
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
  email: nullableTrimmedString(255)
    .refine(
      (value) =>
        value === undefined || value === null || z.string().email().safeParse(value).success,
      { message: 'Invalid email' },
    )
    .transform((value) => value?.toLowerCase() ?? value),
  phone: nullableTrimmedString(40),
  notes: nullableTrimmedString(2000),
  memberSince: nullablePastOrTodayDate,
  birthday: nullablePastOrTodayDate,
  anniversary: nullablePastOrTodayDate,
  biography: nullableTrimmedString(5000),
  familyNotes: nullableTrimmedString(3000),
  role: z.enum(['MEMBER', 'VIEWER']).default('MEMBER'),
  ministries: memberMinistriesSchema.optional(),
});

export const updateOrganizationMemberProfileSchema = z
  .object({
    displayName: z.string().trim().min(2).max(160).optional(),
    email: nullableTrimmedString(255)
      .refine(
        (value) =>
          value === undefined || value === null || z.string().email().safeParse(value).success,
        { message: 'Invalid email' },
      )
      .transform((value) => value?.toLowerCase() ?? value),
    phone: nullableTrimmedString(40),
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
