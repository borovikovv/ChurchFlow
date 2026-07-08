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
  adminOrganizationWorkspaceViewSchema,
  adminOrganizationWorkspaceStatusSchema,
  listAdminOrganizationWorkspaceQuerySchema,
  websitePageSchema,
  websiteSectionSchema,
  updateCurrentUserProfileSchema,
  createOrganizationMemberRelationshipSchema,
  createMemberPhotoUploadSchema,
  confirmMemberPhotoUploadSchema,
  calendarEventTypeSchema,
  calendarEventReminderSchema,
  calendarEventRepeatPeriodSchema,
  listCalendarEventsQuerySchema,
  createCalendarEventSchema,
  updateCalendarEventSchema,
  updateCalendarPreferencesSchema,
  toggleCalendarTaskCompletionSchema,
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
export type OrganizationMembersAccessFilter = z.infer<typeof organizationMembersAccessFilterSchema>;
export type ListOrganizationMembersQuery = z.infer<typeof listOrganizationMembersQuerySchema>;
export type AdminOrganizationWorkspaceView = z.infer<typeof adminOrganizationWorkspaceViewSchema>;
export type AdminOrganizationWorkspaceStatus = z.infer<
  typeof adminOrganizationWorkspaceStatusSchema
>;
export type ListAdminOrganizationWorkspaceQuery = z.infer<
  typeof listAdminOrganizationWorkspaceQuerySchema
>;
export type UpdateCurrentUserProfileInput = z.infer<typeof updateCurrentUserProfileSchema>;
export type CreateOrganizationMemberRelationshipInput = z.infer<
  typeof createOrganizationMemberRelationshipSchema
>;
export type CreateMemberPhotoUploadInput = z.infer<typeof createMemberPhotoUploadSchema>;
export type ConfirmMemberPhotoUploadInput = z.infer<typeof confirmMemberPhotoUploadSchema>;
export type CalendarEventType = z.infer<typeof calendarEventTypeSchema>;
export type CalendarEventReminder = z.infer<typeof calendarEventReminderSchema>;
export type CalendarEventRepeatPeriod = z.infer<typeof calendarEventRepeatPeriodSchema>;
export type ListCalendarEventsQuery = z.infer<typeof listCalendarEventsQuerySchema>;
export type CreateCalendarEventInput = z.infer<typeof createCalendarEventSchema>;
export type UpdateCalendarEventInput = z.infer<typeof updateCalendarEventSchema>;
export type UpdateCalendarPreferencesInput = z.infer<typeof updateCalendarPreferencesSchema>;
export type ToggleCalendarTaskCompletionInput = z.infer<typeof toggleCalendarTaskCompletionSchema>;

export interface CalendarEventMemberSummary {
  id: string;
  displayName: string;
  photoAssetId: string | null;
  photoUrl: string | null;
}

export interface CalendarEventImageSummary {
  id: string;
  url: string | null;
}

export interface CalendarEventItem {
  id: string;
  occurrenceId: string;
  baseEventId: string;
  type: CalendarEventType;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string | null;
  allDay: boolean;
  reminder: CalendarEventReminder | null;
  repeatPeriod: CalendarEventRepeatPeriod;
  taskCompleted: boolean;
  linkedMember: CalendarEventMemberSummary | null;
  assignees: CalendarEventMemberSummary[];
  image: CalendarEventImageSummary | null;
}

export interface CalendarMemberOption {
  id: string;
  displayName: string;
  birthday: string | null;
  anniversary: string | null;
  photoAssetId: string | null;
  photoUrl: string | null;
}

export interface CalendarPreferences {
  visibleEventTypes: CalendarEventType[];
}

export interface CalendarEventsPayload {
  actorRole: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER' | null;
  canManage: boolean;
  events: CalendarEventItem[];
  preferences: CalendarPreferences;
  members: CalendarMemberOption[];
}

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

export interface ResendOrganizationRequestNotificationResult {
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
