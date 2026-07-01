import type { z } from 'zod';
import type {
  acceptInvitationSchema,
  approveOrganizationRequestSchema,
  createOrganizationInvitationSchema,
  createManualOrganizationMemberSchema,
  createOrganizationRequestSchema,
  jwtPayloadSchema,
  organizationSchema,
  organizationWebsiteSchema,
  rejectOrganizationRequestSchema,
  updateOrganizationMemberRoleSchema,
  updateOrganizationMemberProfileSchema,
  membershipClaimTokenSchema,
  listOrganizationMembersQuerySchema,
  organizationMembersAccessFilterSchema,
  websitePageSchema,
  websiteSectionSchema,
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
export type UpdateOrganizationMemberRoleInput = z.infer<typeof updateOrganizationMemberRoleSchema>;
export type CreateManualOrganizationMemberInput = z.infer<
  typeof createManualOrganizationMemberSchema
>;
export type UpdateOrganizationMemberProfileInput = z.infer<
  typeof updateOrganizationMemberProfileSchema
>;
export type MembershipClaimTokenInput = z.infer<typeof membershipClaimTokenSchema>;
export type OrganizationMembersAccessFilter = z.infer<
  typeof organizationMembersAccessFilterSchema
>;
export type ListOrganizationMembersQuery = z.infer<typeof listOrganizationMembersQuerySchema>;

export interface OrganizationRequestStatusItem {
  id: string;
  organizationName: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
  rejectionReason: string | null;
  createdAt: string;
  createdOrganization: {
    id: string;
    name: string;
    slug: string;
  } | null;
}

export interface ResubmitOrganizationRequestResult {
  request: OrganizationRequestStatusItem;
  notificationSent: boolean;
}

export interface DeleteOrganizationRequestResult {
  deletedRequestId: string;
}

export interface MembershipClaimMutationResult {
  claim: {
    id: string;
    status: string;
  };
  claimUrl: string;
  expiresAt: string;
  emailSent: boolean;
}

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
