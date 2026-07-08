import type { CalendarMemberOption } from '@churchflow/shared';
import type { UseFormSetError, UseFormSetValue } from 'react-hook-form';
import type { CreateCalendarEventInput } from '@churchflow/shared';
import type { CalendarFormState } from './calendar-types';
import { CALENDAR_REPEAT, CALENDAR_TYPE } from './calendar-constants';
import { combineLocalDateTime } from './calendar-date-utils';

export function formPayload(form: CalendarFormState): CreateCalendarEventInput {
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
  };
}

export function validateCalendarForm(
  form: CalendarFormState,
  setError: UseFormSetError<CalendarFormState>,
): boolean {
  let valid = true;
  const title = form.title.trim();

  if (!title) {
    setError('title', { message: 'Title is required.' });
    valid = false;
  }

  if (!form.startDate) {
    setError('startDate', { message: 'Start date is required.' });
    valid = false;
  }

  if (!form.allDay && !form.startTime) {
    setError('startTime', { message: 'Start time is required.' });
    valid = false;
  }

  if (form.endDate) {
    const startsAt = new Date(`${form.startDate}T${form.allDay ? '00:00' : form.startTime}`);
    const endsAt = new Date(
      `${form.endDate}T${form.allDay ? '23:59' : form.endTime || form.startTime}`,
    );
    if (startsAt > endsAt) {
      setError('endDate', { message: 'End date must be after the start date.' });
      valid = false;
    }
  }

  if (form.type === CALENDAR_TYPE.task && form.assigneeMembershipIds.length === 0) {
    setError('assigneeMembershipIds', { message: 'Add at least one assignee.' });
    valid = false;
  }

  return valid;
}

export function autofillMemberEvent(
  form: CalendarFormState,
  members: CalendarMemberOption[],
): CalendarFormState {
  const member = members.find((item) => item.id === form.linkedMembershipId);
  if (!member) return form;
  if (form.type === CALENDAR_TYPE.birthday && member.birthday) {
    return {
      ...form,
      title: `${member.displayName} birthday`,
      startDate: member.birthday,
      allDay: true,
      repeatPeriod: CALENDAR_REPEAT.yearly,
    };
  }
  if (form.type === CALENDAR_TYPE.anniversary && member.anniversary) {
    return {
      ...form,
      title: `${member.displayName} anniversary`,
      startDate: member.anniversary,
      allDay: true,
      repeatPeriod: CALENDAR_REPEAT.yearly,
    };
  }

  return form;
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
