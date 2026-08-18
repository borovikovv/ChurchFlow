import type { AuditLogListItem } from '@churchflow/shared';

export const AUDIT_ACTION_KEYS = [
  'ACCEPT',
  'APPROVE',
  'APPROVE_MEMBERSHIP_CLAIM',
  'ARCHIVE',
  'ARCHIVE_MEMBER',
  'CHANGE_MEMBER_ROLE',
  'CONFIRM_CALENDAR_EVENT_IMAGE',
  'CONFIRM_WEBSITE_SECTION_BACKGROUND',
  'CREATE',
  'CREATE_CALENDAR_EVENT',
  'CREATE_MANUAL_MEMBER',
  'CREATE_MEMBER_RELATIONSHIP',
  'CREATE_PRAYER_REQUEST',
  'DELETE',
  'DELETE_CALENDAR_EVENT',
  'DELETE_MEMBER_RELATIONSHIP',
  'DELETE_PRAYER_REQUEST',
  'INVITE',
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
] as const;

const auditActionLabels: Record<(typeof AUDIT_ACTION_KEYS)[number], string> = {
  ACCEPT: 'Invitation accepted',
  APPROVE: 'Request approved',
  APPROVE_MEMBERSHIP_CLAIM: 'Membership claim approved',
  ARCHIVE: 'Organization archived',
  ARCHIVE_MEMBER: 'Member archived',
  CHANGE_MEMBER_ROLE: 'Member role changed',
  CONFIRM_CALENDAR_EVENT_IMAGE: 'Calendar image updated',
  CONFIRM_WEBSITE_SECTION_BACKGROUND: 'Website background updated',
  CREATE: 'Created',
  CREATE_CALENDAR_EVENT: 'Calendar event created',
  CREATE_MANUAL_MEMBER: 'Member added',
  CREATE_MEMBER_RELATIONSHIP: 'Relationship added',
  CREATE_PRAYER_REQUEST: 'Prayer request created',
  DELETE: 'Deleted',
  DELETE_CALENDAR_EVENT: 'Calendar event deleted',
  DELETE_MEMBER_RELATIONSHIP: 'Relationship deleted',
  DELETE_PRAYER_REQUEST: 'Prayer request deleted',
  INVITE: 'Invitation sent',
  MEMBERSHIP_CLAIM_CONFLICT: 'Membership claim conflict recorded',
  PROMOTE_PLATFORM_ADMIN: 'Platform admin promoted',
  REJECT: 'Request rejected',
  REJECTED: 'Membership claim rejected',
  REMOVE_MEMBER: 'Member removed',
  RESEND: 'Invitation resent',
  RESTORE: 'Organization restored',
  RESTORE_MEMBER: 'Member restored',
  RESTORE_PRAYER_REQUEST: 'Prayer request restored',
  REVOKE: 'Invitation revoked',
  REVOKED: 'Membership claim revoked',
  REQUEST_MEMBERSHIP_CLAIM: 'Membership claim requested',
  SUSPEND: 'Organization suspended',
  UPDATE_CALENDAR_EVENT: 'Calendar event updated',
  UPDATE_MEMBER_PHOTO: 'Member photo updated',
  UPDATE_MEMBER_PROFILE: 'Member profile updated',
  UPDATE_ORGANIZATION_LOGO: 'Organization logo updated',
  UPDATE_ORGANIZATION_PROFILE: 'Organization details updated',
  UPDATE_PRAYER_REQUEST: 'Prayer request updated',
  ARCHIVE_PRAYER_REQUEST: 'Prayer request archived',
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
