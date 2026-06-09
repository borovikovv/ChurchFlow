import type { z } from 'zod';
import type {
  jwtPayloadSchema,
  organizationSchema,
  organizationWebsiteSchema,
  websitePageSchema,
  websiteSectionSchema
} from './schemas.js';

export type UUID = string;
export type JwtPayload = z.infer<typeof jwtPayloadSchema>;
export type Organization = z.infer<typeof organizationSchema>;
export type OrganizationWebsite = z.infer<typeof organizationWebsiteSchema>;
export type WebsitePage = z.infer<typeof websitePageSchema>;
export type WebsiteSection = z.infer<typeof websiteSectionSchema>;

export type ApiResult<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      error: {
        code: string;
        message: string;
        requestId?: string;
      };
    };
