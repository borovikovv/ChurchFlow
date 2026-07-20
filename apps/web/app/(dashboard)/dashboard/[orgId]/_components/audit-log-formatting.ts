import type { AuditLogListItem } from '@churchflow/shared';

const auditActionLabels: Record<string, string> = {
  ACCEPT: 'Invitation accepted',
  APPROVE: 'Request approved',
  APPROVE_MEMBERSHIP_CLAIM: 'Membership claim approved',
  ARCHIVE: 'Organization archived',
  CHANGE_MEMBER_ROLE: 'Member role changed',
  CONFIRM_CALENDAR_EVENT_IMAGE: 'Calendar image updated',
  CONFIRM_WEBSITE_SECTION_BACKGROUND: 'Website background updated',
  CREATE: 'Created',
  CREATE_CALENDAR_EVENT: 'Calendar event created',
  CREATE_MANUAL_MEMBER: 'Member added',
  CREATE_MEMBER_RELATIONSHIP: 'Relationship added',
  DELETE: 'Deleted',
  DELETE_CALENDAR_EVENT: 'Calendar event deleted',
  DELETE_MEMBER_RELATIONSHIP: 'Relationship deleted',
  INVITE: 'Invitation sent',
  MEMBERSHIP_CLAIM_CONFLICT: 'Membership claim conflict recorded',
  PROMOTE_PLATFORM_ADMIN: 'Platform admin promoted',
  REJECT: 'Request rejected',
  REJECTED: 'Membership claim rejected',
  REMOVE_MEMBER: 'Member removed',
  RESEND: 'Invitation resent',
  RESTORE: 'Organization restored',
  REVOKE: 'Invitation revoked',
  REVOKED: 'Membership claim revoked',
  REQUEST_MEMBERSHIP_CLAIM: 'Membership claim requested',
  SUSPEND: 'Organization suspended',
  UPDATE_CALENDAR_EVENT: 'Calendar event updated',
  UPDATE_MEMBER_PHOTO: 'Member photo updated',
  UPDATE_MEMBER_PROFILE: 'Member profile updated',
  UPDATE_ORGANIZATION_LOGO: 'Organization logo updated',
  UPDATE_ORGANIZATION_PROFILE: 'Organization details updated',
};

export const auditDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: '2-digit',
  day: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  timeZone: 'UTC',
  timeZoneName: 'short',
});

export function auditActorName(log: AuditLogListItem): string {
  return (
    log.actor?.displayName ?? log.actor?.email ?? (log.actorUserId ? 'Unknown actor' : 'System')
  );
}

export function auditActionLabel(action: string): string {
  return auditActionLabels[action] ?? action.toLowerCase().replaceAll('_', ' ');
}

export function auditMetadataSummary(log: AuditLogListItem): string {
  const changedFields = log.metadata['changedFields'];
  if (Array.isArray(changedFields) && changedFields.length > 0) {
    return `Changed ${changedFields.map(String).join(', ')}`;
  }

  const role = log.metadata['role'];
  if (typeof role === 'string') {
    return `Role: ${role}`;
  }

  const status = log.metadata['status'];
  if (typeof status === 'string') {
    return `Status: ${status}`;
  }

  return log.entityType;
}
