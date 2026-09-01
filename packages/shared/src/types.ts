import type { z } from 'zod';
import type {
  acceptInvitationSchema,
  approveOrganizationRequestSchema,
  createOrganizationInvitationSchema,
  createManualOrganizationMemberSchema,
  importOrganizationMembersCsvResultSchema,
  createOrganizationRequestSchema,
  auditLogListItemSchema,
  auditLogsPageSchema,
  listAuditLogsQuerySchema,
  organizationSchema,
  organizationWebsiteSchema,
  billingCheckoutSchema,
  grantBillingExemptionSchema,
  subscriptionSummarySchema,
  updateOrganizationSchema,
  rejectOrganizationRequestSchema,
  updateOrganizationMemberRoleSchema,
  updateOrganizationMemberProfileSchema,
  membershipClaimTokenSchema,
  listOrganizationMembersQuerySchema,
  organizationMembersAccessFilterSchema,
  organizationMembersTabSchema,
  organizationMembersTypeFilterSchema,
  adminOrganizationWorkspaceViewSchema,
  adminOrganizationWorkspaceStatusSchema,
  listAdminOrganizationWorkspaceQuerySchema,
  websitePageSchema,
  websiteSectionSchema,
  updateWebsiteSettingsSchema,
  upsertWebsitePageSchema,
  upsertWebsiteSectionSchema,
  publishWebsiteSchema,
  publishWebsitePageSchema,
  reorderWebsiteSectionsSchema,
  updateCurrentUserProfileSchema,
  createOrganizationMemberRelationshipSchema,
  createMemberPhotoUploadSchema,
  confirmMemberPhotoUploadSchema,
  calendarEventTypeSchema,
  calendarEventReminderSchema,
  calendarEventRepeatPeriodSchema,
  calendarServiceRoleSchema,
  memberAccessMethodSchema,
  memberMinistrySchema,
  listCalendarEventsQuerySchema,
  createCalendarEventSchema,
  updateCalendarEventSchema,
  updateCalendarPreferencesSchema,
  toggleCalendarTaskCompletionSchema,
  prayerRequestTabSchema,
  listPrayerRequestsQuerySchema,
  createPrayerRequestSchema,
  updatePrayerRequestSchema,
  archivePrayerRequestSchema,
  budgetGroupSchema,
  budgetCategoryTypeSchema,
  budgetEntryFieldSchema,
  budgetCurrencySchema,
  budgetAmountFieldSchema,
  listBudgetQuerySchema,
  createBudgetMonthSchema,
  createBudgetCategorySchema,
  updateBudgetCategorySchema,
  updateBudgetEntrySchema,
  updateBudgetEntryNoteSchema,
  budgetExchangeSchema,
  updateBudgetBaseCurrencySchema,
  updateBudgetOpeningBalanceSchema,
  notificationTypeSchema,
  listNotificationsQuerySchema,
  notificationListItemSchema,
  notificationDetailSchema,
  notificationsPageSchema,
  notificationsSummarySchema,
  notificationPreferencesSchema,
  telegramNotificationDisconnectSchema,
  telegramNotificationLinkSchema,
  updateNotificationPreferencesSchema,
  appLocaleSchema,
  userSessionSchema,
} from './schemas.js';

export type UUID = string;
export type UserSession = z.infer<typeof userSessionSchema>;
export type Organization = z.infer<typeof organizationSchema>;
export type OrganizationWebsite = z.infer<typeof organizationWebsiteSchema>;
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
export type GrantBillingExemptionInput = z.infer<typeof grantBillingExemptionSchema>;
export type SubscriptionSummary = z.infer<typeof subscriptionSummarySchema>;
export type BillingCheckout = z.infer<typeof billingCheckoutSchema>;
export type ListAuditLogsQuery = z.infer<typeof listAuditLogsQuerySchema>;
export type AuditLogListItem = z.infer<typeof auditLogListItemSchema>;
export type AuditLogsPage = z.infer<typeof auditLogsPageSchema>;
export type WebsitePage = z.infer<typeof websitePageSchema>;
export type WebsiteSection = z.infer<typeof websiteSectionSchema>;
export type UpdateWebsiteSettingsInput = z.infer<typeof updateWebsiteSettingsSchema>;
export type UpsertWebsitePageInput = z.infer<typeof upsertWebsitePageSchema>;
export type UpsertWebsiteSectionInput = z.infer<typeof upsertWebsiteSectionSchema>;
export type PublishWebsiteInput = z.infer<typeof publishWebsiteSchema>;
export type PublishWebsitePageInput = z.infer<typeof publishWebsitePageSchema>;
export type ReorderWebsiteSectionsInput = z.infer<typeof reorderWebsiteSectionsSchema>;
export type CreateOrganizationRequestInput = z.infer<typeof createOrganizationRequestSchema>;
export type ApproveOrganizationRequestInput = z.infer<typeof approveOrganizationRequestSchema>;
export type RejectOrganizationRequestInput = z.infer<typeof rejectOrganizationRequestSchema>;
export type CreateOrganizationInvitationInput = z.infer<typeof createOrganizationInvitationSchema>;
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;
export type UpdateOrganizationMemberRoleInput = z.infer<typeof updateOrganizationMemberRoleSchema>;
export type CreateManualOrganizationMemberInput = z.infer<
  typeof createManualOrganizationMemberSchema
>;
export type ImportOrganizationMembersCsvResult = z.infer<
  typeof importOrganizationMembersCsvResultSchema
>;
export type UpdateOrganizationMemberProfileInput = z.infer<
  typeof updateOrganizationMemberProfileSchema
>;
export type MembershipClaimTokenInput = z.infer<typeof membershipClaimTokenSchema>;
export type OrganizationMembersAccessFilter = z.infer<typeof organizationMembersAccessFilterSchema>;
export type OrganizationMembersTab = z.infer<typeof organizationMembersTabSchema>;
export type OrganizationMembersTypeFilter = z.infer<typeof organizationMembersTypeFilterSchema>;
export type ListOrganizationMembersQuery = z.infer<typeof listOrganizationMembersQuerySchema>;
export type AdminOrganizationWorkspaceView = z.infer<typeof adminOrganizationWorkspaceViewSchema>;
export type AdminOrganizationWorkspaceStatus = z.infer<
  typeof adminOrganizationWorkspaceStatusSchema
>;
export type ListAdminOrganizationWorkspaceQuery = z.infer<
  typeof listAdminOrganizationWorkspaceQuerySchema
>;
export type UpdateCurrentUserProfileInput = z.infer<typeof updateCurrentUserProfileSchema>;
export type AppLocale = z.infer<typeof appLocaleSchema>;
export type CreateOrganizationMemberRelationshipInput = z.infer<
  typeof createOrganizationMemberRelationshipSchema
>;
export type CreateMemberPhotoUploadInput = z.infer<typeof createMemberPhotoUploadSchema>;
export type ConfirmMemberPhotoUploadInput = z.infer<typeof confirmMemberPhotoUploadSchema>;
export type CalendarEventType = z.infer<typeof calendarEventTypeSchema>;
export type CalendarEventReminder = z.infer<typeof calendarEventReminderSchema>;
export type CalendarEventRepeatPeriod = z.infer<typeof calendarEventRepeatPeriodSchema>;
export type CalendarServiceRole = z.infer<typeof calendarServiceRoleSchema>;
export type MemberAccessMethod = z.infer<typeof memberAccessMethodSchema>;
export type MemberMinistry = z.infer<typeof memberMinistrySchema>;
export type ListCalendarEventsQuery = z.infer<typeof listCalendarEventsQuerySchema>;
export type CreateCalendarEventInput = z.infer<typeof createCalendarEventSchema>;
export type UpdateCalendarEventInput = z.infer<typeof updateCalendarEventSchema>;
export type UpdateCalendarPreferencesInput = z.infer<typeof updateCalendarPreferencesSchema>;
export type ToggleCalendarTaskCompletionInput = z.infer<typeof toggleCalendarTaskCompletionSchema>;
export type PrayerRequestTab = z.infer<typeof prayerRequestTabSchema>;
export type ListPrayerRequestsQuery = z.infer<typeof listPrayerRequestsQuerySchema>;
export type CreatePrayerRequestInput = z.infer<typeof createPrayerRequestSchema>;
export type UpdatePrayerRequestInput = z.infer<typeof updatePrayerRequestSchema>;
export type ArchivePrayerRequestInput = z.infer<typeof archivePrayerRequestSchema>;
export type BudgetGroup = z.infer<typeof budgetGroupSchema>;
export type BudgetCategoryType = z.infer<typeof budgetCategoryTypeSchema>;
export type BudgetEntryField = z.infer<typeof budgetEntryFieldSchema>;
export type BudgetCurrency = z.infer<typeof budgetCurrencySchema>;
export type BudgetAmountField = z.infer<typeof budgetAmountFieldSchema>;
export type ListBudgetQuery = z.infer<typeof listBudgetQuerySchema>;
export type CreateBudgetMonthInput = z.infer<typeof createBudgetMonthSchema>;
export type CreateBudgetCategoryInput = z.infer<typeof createBudgetCategorySchema>;
export type UpdateBudgetCategoryInput = z.infer<typeof updateBudgetCategorySchema>;
export type UpdateBudgetEntryInput = z.infer<typeof updateBudgetEntrySchema>;
export type UpdateBudgetEntryNoteInput = z.infer<typeof updateBudgetEntryNoteSchema>;
export type BudgetExchangeInput = z.infer<typeof budgetExchangeSchema>;
export type UpdateBudgetBaseCurrencyInput = z.infer<typeof updateBudgetBaseCurrencySchema>;
export type UpdateBudgetOpeningBalanceInput = z.infer<typeof updateBudgetOpeningBalanceSchema>;
export type NotificationType = z.infer<typeof notificationTypeSchema>;
export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;
export type NotificationListItem = z.infer<typeof notificationListItemSchema>;
export type NotificationDetail = z.infer<typeof notificationDetailSchema>;
export type NotificationsPage = z.infer<typeof notificationsPageSchema>;
export type NotificationsSummary = z.infer<typeof notificationsSummarySchema>;
export type NotificationPreferences = z.infer<typeof notificationPreferencesSchema>;
export type UpdateNotificationPreferencesInput = z.infer<
  typeof updateNotificationPreferencesSchema
>;
export type TelegramNotificationLink = z.infer<typeof telegramNotificationLinkSchema>;
export type TelegramNotificationDisconnect = z.infer<typeof telegramNotificationDisconnectSchema>;

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

export interface CalendarServicePerson {
  membershipId: string | null;
  customName: string | null;
  displayName: string;
  photoAssetId: string | null;
  photoUrl: string | null;
}

export interface CalendarServiceDetails {
  hasCommunion: boolean;
  biblePassage: string | null;
  preacher: CalendarServicePerson | null;
  serviceHost: CalendarServicePerson | null;
  worshipLead: CalendarServicePerson | null;
  communionLead: CalendarServicePerson | null;
  songs: string[];
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
  serviceDetails: CalendarServiceDetails | null;
}

export interface CalendarMemberOption {
  id: string;
  displayName: string;
  birthday: string | null;
  anniversary: string | null;
  photoAssetId: string | null;
  photoUrl: string | null;
  ministries: MemberMinistry[];
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

export interface PrayerRequestAuthor {
  membershipId: string | null;
  userId: string | null;
  displayName: string;
}

export interface PrayerRequestItem {
  id: string;
  organizationId: string;
  title: string;
  description: string;
  archiveReason: string | null;
  author: PrayerRequestAuthor;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  canEdit: boolean;
  canDelete: boolean;
  canArchive: boolean;
  canRestore: boolean;
}

export interface PrayerRequestsPayload {
  actorRole: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER' | null;
  actorMembershipId: string | null;
  tab: PrayerRequestTab;
  items: PrayerRequestItem[];
  counts: {
    active: number;
    archived: number;
  };
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    pageCount: number;
    nextCursor: string | null;
  };
}

export interface BudgetCurrencyTotals {
  amountUah: number;
  amountUsd: number;
  amountEur: number;
}

export interface BudgetTotals {
  income: BudgetCurrencyTotals;
  expense: BudgetCurrencyTotals;
  exchange: BudgetCurrencyTotals;
  balance: BudgetCurrencyTotals;
}

export interface BudgetCategory {
  id: string;
  group: BudgetGroup;
  type: BudgetCategoryType;
  name: string;
  order: number;
}

export interface BudgetEntryNote {
  field: BudgetEntryField;
  note: string;
}

export interface BudgetEntry {
  id: string;
  categoryId: string;
  rowIndex: number;
  amountUah: number;
  amountUsd: number;
  amountEur: number;
  notes: BudgetEntryNote[];
}

export interface BudgetExchange {
  id: string;
  monthId: string;
  occurredOn: string;
  fromCurrency: BudgetCurrency;
  fromAmount: number;
  toCurrency: BudgetCurrency;
  toAmount: number;
  dealRate: number;
  officialRate: number | null;
  note: string | null;
}

export interface BudgetMonth {
  id: string;
  year: number;
  month: number;
  rowCount: number;
  entries: BudgetEntry[];
  exchanges: BudgetExchange[];
  totals: BudgetTotals;
  rates: ExchangeRates | null;
}

export interface BudgetGroupSummary {
  group: BudgetGroup;
  totals: BudgetTotals;
}

export interface ExchangeRates {
  date: string;
  usdToUah: number;
  eurToUah: number;
}

export interface BudgetOpeningBalance {
  sinceYear: number | null;
  seed: BudgetCurrencyTotals;
  opening: BudgetCurrencyTotals;
}

export interface BudgetPayload {
  actorRole: 'OWNER' | 'ADMIN';
  canManage: true;
  year: number;
  baseCurrency: BudgetCurrency;
  categories: BudgetCategory[];
  months: BudgetMonth[];
  yearTotals: BudgetTotals;
  groupSummaries: BudgetGroupSummary[];
  openingBalance: BudgetOpeningBalance;
  rates: ExchangeRates | null;
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
