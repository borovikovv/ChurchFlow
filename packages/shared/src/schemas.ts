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
  type: z.enum(['access', 'refresh'])
});

export const authProviderSchema = z.enum(['telegram', 'webauthn', 'email', 'google', 'apple']);

export const organizationRoleSchema = z.enum(['OWNER', 'ADMIN', 'EDITOR', 'MEMBER']);

export const organizationSchema = z.object({
  id: uuidSchema,
  name: z.string().min(1).max(160),
  slug: slugSchema,
  description: z.string().max(500).nullable()
});

export const createOrganizationSchema = z.object({
  name: z.string().min(1).max(160),
  slug: slugSchema,
  description: z.string().max(500).optional()
});

export const organizationWebsiteSchema = z.object({
  id: uuidSchema,
  organizationId: uuidSchema,
  title: z.string().min(1).max(160),
  description: z.string().max(500).nullable(),
  publishedAt: z.coerce.date().nullable()
});

export const updateWebsiteSettingsSchema = z.object({
  title: z.string().min(1).max(160),
  description: z.string().max(500).optional(),
  theme: z.record(z.unknown()).default({}),
  settings: z.record(z.unknown()).default({})
});

export const pageStatusSchema = z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']);

export const websitePageSchema = z.object({
  id: uuidSchema,
  organizationId: uuidSchema,
  websiteId: uuidSchema,
  slug: slugSchema,
  title: z.string().min(1).max(160),
  status: pageStatusSchema
});

export const upsertWebsitePageSchema = z.object({
  slug: slugSchema,
  title: z.string().min(1).max(160),
  status: pageStatusSchema.default('DRAFT'),
  seo: z.record(z.unknown()).default({})
});

export const sectionTypeSchema = z.enum(PUBLIC_SECTION_TYPES);

export const websiteSectionSchema = z.object({
  id: uuidSchema,
  organizationId: uuidSchema,
  pageId: uuidSchema,
  type: sectionTypeSchema,
  order: z.number().int().min(0),
  content: z.record(z.unknown())
});

export const upsertWebsiteSectionSchema = z.object({
  type: sectionTypeSchema,
  order: z.number().int().min(0),
  content: z.record(z.unknown()).default({})
});

export const mediaAssetSchema = z.object({
  id: uuidSchema,
  organizationId: uuidSchema,
  filename: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(120),
  byteSize: z.bigint().nonnegative(),
  altText: z.string().max(300).nullable()
});

export const paginationQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25)
});
