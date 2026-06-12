import type { z } from 'zod';
import type {
  acceptInvitationSchema,
  approveOrganizationRequestSchema,
  createOrganizationInvitationSchema,
  createOrganizationRequestSchema,
  jwtPayloadSchema,
  organizationSchema,
  organizationWebsiteSchema,
  rejectOrganizationRequestSchema,
  startEmailLoginSchema,
  verifyEmailLoginSchema,
  websitePageSchema,
  websiteSectionSchema
} from './schemas.js';

export type UUID = string;
export type JwtPayload = z.infer<typeof jwtPayloadSchema>;
export type Organization = z.infer<typeof organizationSchema>;
export type OrganizationWebsite = z.infer<typeof organizationWebsiteSchema>;
export type WebsitePage = z.infer<typeof websitePageSchema>;
export type WebsiteSection = z.infer<typeof websiteSectionSchema>;
export type CreateOrganizationRequestInput = z.infer<typeof createOrganizationRequestSchema>;
export type ApproveOrganizationRequestInput = z.infer<typeof approveOrganizationRequestSchema>;
export type RejectOrganizationRequestInput = z.infer<typeof rejectOrganizationRequestSchema>;
export type CreateOrganizationInvitationInput = z.infer<typeof createOrganizationInvitationSchema>;
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;
export type StartEmailLoginInput = z.infer<typeof startEmailLoginSchema>;
export type VerifyEmailLoginInput = z.infer<typeof verifyEmailLoginSchema>;

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
