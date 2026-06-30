import { z } from 'zod';
import { PUBLIC_SECTION_TYPES } from './constants.js';

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
export const organizationRequestStatusSchema = z.enum([
  'PENDING',
  'APPROVED',
  'REJECTED',
  'EXPIRED',
]);

const optionalTrimmedString = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value === '' ? undefined : value));

export const organizationSchema = z.object({
  id: uuidSchema,
  name: z.string().min(1).max(160),
  slug: slugSchema,
  description: z.string().max(500).nullable(),
  status: organizationStatusSchema.default('ACTIVE'),
});

export const createOrganizationSchema = z.object({
  name: z.string().min(1).max(160),
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
