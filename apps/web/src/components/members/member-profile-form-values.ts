import type { UpdateOrganizationMemberProfileInput } from '@churchflow/shared';
import type { EditableMember } from './member-actions.types';

export function memberProfileFormValues(
  member: EditableMember,
): UpdateOrganizationMemberProfileInput {
  return {
    displayName: member.profile.displayName,
    email: member.profile.email,
    phone: member.profile.phone,
    notes: member.profile.notes,
    memberSince: member.profile.memberSince?.slice(0, 10) ?? null,
    birthday: member.profile.birthday?.slice(0, 10) ?? null,
    anniversary: member.profile.anniversary?.slice(0, 10) ?? null,
    biography: member.profile.biography,
    familyNotes: member.profile.familyNotes,
    ministries: [...member.ministries],
  };
}
