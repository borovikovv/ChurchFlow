import type { AuditLogListItem } from '@churchflow/shared';

const BUDGET_ENTITY_TYPE = 'Budget';

const BUDGET_AMOUNT_CURRENCIES: Record<string, string> = {
  amountUah: 'UAH',
  amountUsd: 'USD',
  amountEur: 'EUR',
};

export const AUDIT_ACTION_KEYS = [
  'ACCEPT',
  'ADD_BUDGET_ROW',
  'APPROVE',
  'APPROVE_MEMBERSHIP_CLAIM',
  'ARCHIVE',
  'ARCHIVE_MEMBER',
  'CANCEL_SUBSCRIPTION',
  'CHANGE_MEMBER_ROLE',
  'CONFIRM_CALENDAR_EVENT_IMAGE',
  'CONFIRM_WEBSITE_SECTION_BACKGROUND',
  'CREATE',
  'CREATE_BUDGET_CATEGORY',
  'CREATE_BUDGET_MONTH',
  'CREATE_CALENDAR_EVENT',
  'CREATE_MANUAL_MEMBER',
  'CREATE_MEMBER_RELATIONSHIP',
  'CREATE_PRAYER_REQUEST',
  'DELETE',
  'DELETE_BUDGET_CATEGORY',
  'DELETE_BUDGET_MONTH',
  'DELETE_CALENDAR_EVENT',
  'DELETE_MEMBER_RELATIONSHIP',
  'DELETE_PRAYER_REQUEST',
  'GRANT_BILLING_EXEMPTION',
  'INVITE',
  'REMOVE_BUDGET_ROW',
  'REVOKE_BILLING_EXEMPTION',
  'START_SUBSCRIPTION',
  'UPDATE_BUDGET_CATEGORY',
  'UPDATE_BUDGET_ENTRY',
  'UPDATE_BUDGET_ENTRY_NOTE',
  'UPDATE_BUDGET_OPENING_BALANCE',
  'MEMBERSHIP_CLAIM_CONFLICT',
  'PROMOTE_PLATFORM_ADMIN',
  'REJECT',
  'REJECTED',
  'REMOVE_MEMBER',
  'RESEND',
  'RESTORE',
  'RESTORE_MEMBER',
  'RESTORE_PRAYER_REQUEST',
  'REVOKE',
  'REVOKED',
  'REQUEST_MEMBERSHIP_CLAIM',
  'SUSPEND',
  'UPDATE_CALENDAR_EVENT',
  'UPDATE_MEMBER_PHOTO',
  'UPDATE_MEMBER_PROFILE',
  'UPDATE_ORGANIZATION_LOGO',
  'UPDATE_ORGANIZATION_PROFILE',
  'UPDATE_PRAYER_REQUEST',
  'ARCHIVE_PRAYER_REQUEST',
  'UPDATE_SUBSCRIPTION',
] as const;

const auditActionLabels: Record<(typeof AUDIT_ACTION_KEYS)[number], string> = {
  ACCEPT: 'Invitation accepted',
  ADD_BUDGET_ROW: 'Budget row added',
  APPROVE: 'Request approved',
  APPROVE_MEMBERSHIP_CLAIM: 'Membership claim approved',
  ARCHIVE: 'Organization archived',
  ARCHIVE_MEMBER: 'Member archived',
  CANCEL_SUBSCRIPTION: 'Subscription canceled',
  CHANGE_MEMBER_ROLE: 'Member role changed',
  CONFIRM_CALENDAR_EVENT_IMAGE: 'Calendar image updated',
  CONFIRM_WEBSITE_SECTION_BACKGROUND: 'Website background updated',
  CREATE: 'Created',
  CREATE_BUDGET_CATEGORY: 'Budget category created',
  CREATE_BUDGET_MONTH: 'Budget month created',
  CREATE_CALENDAR_EVENT: 'Calendar event created',
  CREATE_MANUAL_MEMBER: 'Member added',
  CREATE_MEMBER_RELATIONSHIP: 'Relationship added',
  CREATE_PRAYER_REQUEST: 'Prayer request created',
  DELETE: 'Deleted',
  DELETE_BUDGET_CATEGORY: 'Budget category deleted',
  DELETE_BUDGET_MONTH: 'Budget month deleted',
  DELETE_CALENDAR_EVENT: 'Calendar event deleted',
  DELETE_MEMBER_RELATIONSHIP: 'Relationship deleted',
  DELETE_PRAYER_REQUEST: 'Prayer request deleted',
  GRANT_BILLING_EXEMPTION: 'Complimentary access granted',
  INVITE: 'Invitation sent',
  MEMBERSHIP_CLAIM_CONFLICT: 'Membership claim conflict recorded',
  PROMOTE_PLATFORM_ADMIN: 'Platform admin promoted',
  REJECT: 'Request rejected',
  REJECTED: 'Membership claim rejected',
  REMOVE_BUDGET_ROW: 'Budget row removed',
  REMOVE_MEMBER: 'Member removed',
  RESEND: 'Invitation resent',
  RESTORE: 'Organization restored',
  RESTORE_MEMBER: 'Member restored',
  RESTORE_PRAYER_REQUEST: 'Prayer request restored',
  REVOKE: 'Invitation revoked',
  REVOKED: 'Membership claim revoked',
  REQUEST_MEMBERSHIP_CLAIM: 'Membership claim requested',
  REVOKE_BILLING_EXEMPTION: 'Complimentary access revoked',
  START_SUBSCRIPTION: 'Subscription started',
  SUSPEND: 'Organization suspended',
  UPDATE_BUDGET_CATEGORY: 'Budget category updated',
  UPDATE_BUDGET_ENTRY: 'Budget cell updated',
  UPDATE_BUDGET_ENTRY_NOTE: 'Budget note updated',
  UPDATE_BUDGET_OPENING_BALANCE: 'Opening balance updated',
  UPDATE_CALENDAR_EVENT: 'Calendar event updated',
  UPDATE_MEMBER_PHOTO: 'Member photo updated',
  UPDATE_MEMBER_PROFILE: 'Member profile updated',
  UPDATE_ORGANIZATION_LOGO: 'Organization logo updated',
  UPDATE_ORGANIZATION_PROFILE: 'Organization details updated',
  UPDATE_PRAYER_REQUEST: 'Prayer request updated',
  ARCHIVE_PRAYER_REQUEST: 'Prayer request archived',
  UPDATE_SUBSCRIPTION: 'Subscription updated',
};

export function createAuditDateFormatter(locale: string) {
  return new Intl.DateTimeFormat(locale === 'uk' ? 'uk-UA' : 'en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'UTC',
    timeZoneName: 'short',
  });
}

export function auditActorName(
  log: AuditLogListItem,
  labels: { system: string; unknownActor: string },
): string {
  return (
    log.actor?.displayName ??
    log.actor?.email ??
    (log.actorUserId ? labels.unknownActor : labels.system)
  );
}

export function auditActionLabel(action: string, labels: Record<string, string>): string {
  return (
    labels[action] ??
    auditActionLabels[action as keyof typeof auditActionLabels] ??
    action.toLowerCase().replaceAll('_', ' ')
  );
}

export function auditMetadataSummary(
  log: AuditLogListItem,
  labels: {
    changedFields: (fields: string) => string;
    metadataRole: (role: string) => string;
    metadataStatus: (status: string) => string;
  },
): string {
  if (log.entityType === BUDGET_ENTITY_TYPE) {
    return budgetMetadataSummary(log, labels);
  }

  const changedFields = log.metadata['changedFields'];
  if (Array.isArray(changedFields) && changedFields.length > 0) {
    return labels.changedFields(changedFields.map(String).join(', '));
  }

  const role = log.metadata['role'];
  if (typeof role === 'string') {
    return labels.metadataRole(role);
  }

  const status = log.metadata['status'];
  if (typeof status === 'string') {
    return labels.metadataStatus(status);
  }

  return log.entityType;
}

function budgetMetadataSummary(
  log: AuditLogListItem,
  labels: { changedFields: (fields: string) => string },
): string {
  const context = budgetContext(log.metadata);
  const changes = log.metadata['changes'];

  if (Array.isArray(changes)) {
    const formatted = changes
      .map(formatBudgetChange)
      .filter((change): change is string => change !== null);

    if (formatted.length > 0) {
      const summary = formatted.join(', ');
      return context ? `${context}: ${summary}` : summary;
    }
  }

  const name = log.metadata['name'];
  const changedFields = log.metadata['changedFields'];

  if (Array.isArray(changedFields) && changedFields.length > 0) {
    const summary = labels.changedFields(changedFields.map(String).join(', '));
    return typeof name === 'string' ? `${name}: ${summary}` : summary;
  }

  if (typeof name === 'string') {
    return context ? `${context}: ${name}` : name;
  }

  return context || log.entityType;
}

function budgetContext(metadata: Record<string, unknown>): string {
  const parts: string[] = [];
  const year = metadata['year'];
  const month = metadata['month'];

  if (typeof year === 'number' && typeof month === 'number') {
    parts.push(`${String(month).padStart(2, '0')}.${year}`);
  }

  const sinceYear = metadata['sinceYear'];
  if (typeof sinceYear === 'number') {
    parts.push(String(sinceYear));
  }

  const categoryName = metadata['categoryName'];
  if (typeof categoryName === 'string') {
    parts.push(categoryName);
  }

  const rowIndex = metadata['rowIndex'];
  if (typeof rowIndex === 'number') {
    parts.push(`#${rowIndex + 1}`);
  }

  return parts.join(' · ');
}

function formatBudgetChange(change: unknown): string | null {
  if (
    typeof change !== 'object' ||
    change === null ||
    !('field' in change) ||
    !('from' in change) ||
    !('to' in change)
  ) {
    return null;
  }

  const { field, from, to } = change;
  if (typeof field !== 'string' || typeof from !== 'string' || typeof to !== 'string') return null;

  return `${BUDGET_AMOUNT_CURRENCIES[field] ?? field} ${from} → ${to}`;
}
