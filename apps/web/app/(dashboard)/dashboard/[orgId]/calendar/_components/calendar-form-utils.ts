import type { CalendarMemberOption } from '@churchflow/shared';
import type { UseFormSetError, UseFormSetValue } from 'react-hook-form';
import type { CreateCalendarEventInput } from '@churchflow/shared';
import type { CalendarFormState } from './calendar-types';
import { CALENDAR_REPEAT, CALENDAR_TYPE } from './calendar-constants';
import { combineLocalDateTime } from './calendar-date-utils';

export function formPayload(form: CalendarFormState): CreateCalendarEventInput {
  const isService = form.type === CALENDAR_TYPE.service;
  return {
    type: form.type,
    title: form.title,
    description: form.description || null,
    startsAt: combineLocalDateTime(form.startDate, form.allDay ? '00:00' : form.startTime),
    endsAt: form.endDate
      ? combineLocalDateTime(form.endDate, form.allDay ? '23:59' : form.endTime || form.startTime)
      : null,
    allDay: form.allDay,
    reminder: form.reminder || null,
    repeatPeriod: form.repeatPeriod,
    linkedMembershipId: form.linkedMembershipId || null,
    imageAssetId: form.imageAssetId || null,
    assigneeMembershipIds: form.type === CALENDAR_TYPE.task ? form.assigneeMembershipIds : [],
    taskCompleted: form.type === CALENDAR_TYPE.task ? form.taskCompleted : false,
    ...(isService ? { serviceDetails: serviceDetailsPayload(form.serviceDetails) } : {}),
  };
}

export function validateCalendarForm(
  form: CalendarFormState,
  setError: UseFormSetError<CalendarFormState>,
  messages: CalendarValidationMessages,
): boolean {
  let valid = true;
  const title = form.title.trim();

  if (!title) {
    setError('title', { message: messages.titleRequired });
    valid = false;
  }

  if (!form.startDate) {
    setError('startDate', { message: messages.startDateRequired });
    valid = false;
  }

  if (!form.allDay && !form.startTime) {
    setError('startTime', { message: messages.startTimeRequired });
    valid = false;
  }

  if (form.endDate) {
    const startsAt = new Date(`${form.startDate}T${form.allDay ? '00:00' : form.startTime}`);
    const endsAt = new Date(
      `${form.endDate}T${form.allDay ? '23:59' : form.endTime || form.startTime}`,
    );
    if (startsAt > endsAt) {
      setError('endDate', { message: messages.endDateAfterStart });
      valid = false;
    }
  }

  if (form.type === CALENDAR_TYPE.task && form.assigneeMembershipIds.length === 0) {
    setError('assigneeMembershipIds', { message: messages.assigneeRequired });
    valid = false;
  }

  if (form.type === CALENDAR_TYPE.service) {
    valid =
      validateServicePerson(
        form.serviceDetails.preacher,
        'serviceDetails.preacher',
        setError,
        messages,
      ) && valid;
    valid =
      validateOptionalServicePerson(
        form.serviceDetails.serviceHost,
        'serviceDetails.serviceHost',
        setError,
        messages,
      ) && valid;
    valid =
      validateServicePerson(
        form.serviceDetails.worshipLead,
        'serviceDetails.worshipLead',
        setError,
        messages,
      ) && valid;
    if (form.serviceDetails.hasCommunion) {
      const communionLeadValid = validateServicePerson(
        form.serviceDetails.communionLead,
        'serviceDetails.communionLead',
        setError,
        messages,
      );
      valid = valid && communionLeadValid;
    }
  }

  return valid;
}

export function autofillMemberEvent(
  form: CalendarFormState,
  members: CalendarMemberOption[],
  labels?: { anniversary: (name: string) => string; birthday: (name: string) => string },
): CalendarFormState {
  const member = members.find((item) => item.id === form.linkedMembershipId);
  if (!member) return form;
  if (form.type === CALENDAR_TYPE.birthday && member.birthday) {
    return {
      ...form,
      title: labels?.birthday(member.displayName) ?? `${member.displayName} birthday`,
      startDate: member.birthday,
      allDay: true,
      repeatPeriod: CALENDAR_REPEAT.yearly,
    };
  }
  if (form.type === CALENDAR_TYPE.anniversary && member.anniversary) {
    return {
      ...form,
      title: labels?.anniversary(member.displayName) ?? `${member.displayName} anniversary`,
      startDate: member.anniversary,
      allDay: true,
      repeatPeriod: CALENDAR_REPEAT.yearly,
    };
  }

  return form;
}

function serviceDetailsPayload(
  serviceDetails: CalendarFormState['serviceDetails'],
): NonNullable<CreateCalendarEventInput['serviceDetails']> {
  return {
    preacher: servicePersonPayload(serviceDetails.preacher),
    serviceHost: servicePersonPayload(serviceDetails.serviceHost),
    worshipLead: servicePersonPayload(serviceDetails.worshipLead),
    hasCommunion: serviceDetails.hasCommunion,
    communionLead: serviceDetails.hasCommunion
      ? servicePersonPayload(serviceDetails.communionLead)
      : undefined,
    biblePassage: serviceDetails.biblePassage || null,
    songs: serviceDetails.songs
      .split('\n')
      .map((song) => song.trim())
      .filter(Boolean),
  };
}

function servicePersonPayload(person: CalendarFormState['serviceDetails']['preacher']) {
  const membershipId = person.membershipId || undefined;
  const customName = person.customName.trim() || undefined;
  if (!membershipId && !customName) return undefined;
  return { membershipId, customName };
}

function validateServicePerson(
  person: CalendarFormState['serviceDetails']['preacher'],
  path: `serviceDetails.${'preacher' | 'serviceHost' | 'worshipLead' | 'communionLead'}`,
  setError: UseFormSetError<CalendarFormState>,
  messages: CalendarValidationMessages,
): boolean {
  const hasMember = Boolean(person.membershipId);
  const hasGuest = Boolean(person.customName.trim());
  if (hasMember === hasGuest) {
    setError(path, { message: messages.servicePersonRequired });
    return false;
  }
  return true;
}

function validateOptionalServicePerson(
  person: CalendarFormState['serviceDetails']['preacher'],
  path: `serviceDetails.${'serviceHost'}`,
  setError: UseFormSetError<CalendarFormState>,
  messages: CalendarValidationMessages,
): boolean {
  const hasMember = Boolean(person.membershipId);
  const hasGuest = Boolean(person.customName.trim());
  if (hasMember && hasGuest) {
    setError(path, { message: messages.servicePersonSingleValue });
    return false;
  }
  return true;
}

export interface CalendarValidationMessages {
  assigneeRequired: string;
  endDateAfterStart: string;
  servicePersonRequired: string;
  servicePersonSingleValue: string;
  startDateRequired: string;
  startTimeRequired: string;
  titleRequired: string;
}

export function applyFormValues(
  values: CalendarFormState,
  setValue: UseFormSetValue<CalendarFormState>,
) {
  (
    Object.entries(values) as Array<
      [keyof CalendarFormState, CalendarFormState[keyof CalendarFormState]]
    >
  ).forEach(([key, value]) => {
    setValue(key, value, { shouldDirty: true, shouldValidate: true });
  });
}
