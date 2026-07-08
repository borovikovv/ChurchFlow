'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'react-toastify';
import type {
  CalendarEventItem,
  CalendarEventType,
  CalendarMemberOption,
} from '@churchflow/shared';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { FormDatePicker } from '@/components/forms/form-date-picker';
import { FormInput } from '@/components/forms/form-input';
import { FormSelect } from '@/components/forms/form-select';
import { FormTextarea } from '@/components/forms/form-textarea';
import {
  CALENDAR_TYPE,
  EVENT_TYPE_OPTIONS,
  REMINDER_OPTIONS,
  REPEAT_PERIOD_OPTIONS,
} from './calendar-constants';
import type { CalendarFormState } from './calendar-types';
import { applyFormValues, autofillMemberEvent, validateCalendarForm } from './calendar-form-utils';

export function EventModal({
  canManage,
  editingEvent,
  form,
  members,
  mode,
  pending,
  onClose,
  onDelete,
  onImageUpload,
  onSubmit,
}: {
  canManage: boolean;
  editingEvent: CalendarEventItem | null;
  form: CalendarFormState;
  members: CalendarMemberOption[];
  mode: 'create' | 'edit';
  pending: boolean;
  onClose: () => void;
  onDelete: () => void;
  onImageUpload: (file: File) => Promise<{ assetId: string; imageUrl: string } | null>;
  onSubmit: (values: CalendarFormState) => Promise<{ ok: true } | { ok: false; error: string }>;
}) {
  const readonly = !canManage;
  const [assigneeToAdd, setAssigneeToAdd] = useState('');
  const {
    clearErrors,
    control,
    handleSubmit,
    register,
    setError,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CalendarFormState>({
    defaultValues: form,
  });
  const values = watch();
  const selectedAssignees = members.filter((member) =>
    values.assigneeMembershipIds.includes(member.id),
  );
  const availableAssignees = members.filter(
    (member) => !values.assigneeMembershipIds.includes(member.id),
  );
  const submit = handleSubmit(async (nextValues) => {
    if (!validateCalendarForm(nextValues, setError)) return;
    const result = await onSubmit(nextValues);
    if (!result.ok) {
      toast.error(result.error);
    }
  });

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[rgba(31,35,40,0.45)] p-4">
      <div
        aria-modal="true"
        className="grid max-h-[90dvh] w-[min(720px,100%)] grid-rows-[auto_minmax(0,1fr)_auto] rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-xl"
        role="dialog"
      >
        <header className="flex items-center justify-between border-b border-[var(--line)] p-5">
          <h2>{mode === 'create' ? 'New event' : (editingEvent?.title ?? 'Event')}</h2>
          <button className="text-2xl text-[var(--muted)]" type="button" onClick={onClose}>
            ×
          </button>
        </header>
        <form
          className="grid min-h-0 gap-4 overflow-y-auto p-5 sm:grid-cols-2"
          onSubmit={submit}
          noValidate
        >
          <FormSelect
            disabled={readonly}
            error={errors.type?.message}
            label="Type"
            value={values.type}
            {...register('type', {
              onChange: (event) => {
                const next = autofillMemberEvent(
                  { ...values, type: event.currentTarget.value as CalendarEventType },
                  members,
                );
                applyFormValues(next, setValue);
              },
            })}
          >
            {EVENT_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </FormSelect>
          <FormSelect
            disabled={readonly}
            error={errors.linkedMembershipId?.message}
            label="Linked member"
            value={values.linkedMembershipId}
            {...register('linkedMembershipId', {
              onChange: (event) => {
                const next = autofillMemberEvent(
                  { ...values, linkedMembershipId: event.currentTarget.value },
                  members,
                );
                applyFormValues(next, setValue);
              },
            })}
          >
            <option value="">No linked member</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.displayName}
              </option>
            ))}
          </FormSelect>
          <div className="sm:col-span-2">
            <FormInput
              disabled={readonly}
              error={errors.title?.message}
              label="Title"
              {...register('title')}
            />
          </div>
          <div className="sm:col-span-2">
            <FormTextarea
              disabled={readonly}
              error={errors.description?.message}
              label="Description"
              rows={4}
              {...register('description')}
            />
          </div>
          <FormDatePicker
            control={control}
            disabled={readonly}
            error={errors.startDate?.message}
            maxDate={null}
            name="startDate"
            label="Start date"
          />
          <FormInput
            disabled={readonly || values.allDay}
            error={errors.startTime?.message}
            label="Start time"
            type="time"
            {...register('startTime')}
          />
          <FormDatePicker
            control={control}
            disabled={readonly}
            error={errors.endDate?.message}
            maxDate={null}
            name="endDate"
            label="End date"
          />
          <FormInput
            disabled={readonly || values.allDay}
            error={errors.endTime?.message}
            label="End time"
            type="time"
            {...register('endTime')}
          />
          <Checkbox disabled={readonly} label="Full day" {...register('allDay')} />
          <FormSelect
            disabled={readonly}
            error={errors.reminder?.message}
            label="Reminder"
            {...register('reminder')}
          >
            {REMINDER_OPTIONS.map((option) => (
              <option key={option.value || 'none'} value={option.value}>
                {option.label}
              </option>
            ))}
          </FormSelect>
          <FormSelect
            disabled={readonly}
            error={errors.repeatPeriod?.message}
            label="Repeat"
            {...register('repeatPeriod')}
          >
            {REPEAT_PERIOD_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </FormSelect>
          {values.type === CALENDAR_TYPE.task ? (
            <>
              <div className="grid gap-2 sm:col-span-2">
                <label>
                  Assignees
                  <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                    <select
                      disabled={readonly || availableAssignees.length === 0}
                      value={assigneeToAdd}
                      onChange={(event) => setAssigneeToAdd(event.currentTarget.value)}
                    >
                      <option value="">Select member</option>
                      {availableAssignees.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.displayName}
                        </option>
                      ))}
                    </select>
                    <Button
                      disabled={readonly || !assigneeToAdd}
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        if (!assigneeToAdd) return;
                        setValue(
                          'assigneeMembershipIds',
                          [...values.assigneeMembershipIds, assigneeToAdd],
                          { shouldDirty: true, shouldValidate: true },
                        );
                        clearErrors('assigneeMembershipIds');
                        setAssigneeToAdd('');
                      }}
                    >
                      Add
                    </Button>
                  </div>
                </label>
                {selectedAssignees.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {selectedAssignees.map((member) => (
                      <span
                        className="inline-flex items-center gap-2 rounded-md border border-[var(--line)] bg-[var(--surface-subtle)] px-2 py-1 text-sm"
                        key={member.id}
                      >
                        {member.displayName}
                        <button
                          aria-label={`Remove ${member.displayName}`}
                          className="h-5 w-5 rounded border-0 bg-transparent text-[var(--muted)] hover:bg-[var(--line-muted)] hover:text-[var(--foreground)]"
                          disabled={readonly}
                          type="button"
                          onClick={() => {
                            setValue(
                              'assigneeMembershipIds',
                              values.assigneeMembershipIds.filter((id) => id !== member.id),
                              { shouldDirty: true, shouldValidate: true },
                            );
                          }}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}
                {errors.assigneeMembershipIds?.message ? (
                  <p className="form-error m-0 text-xs">{errors.assigneeMembershipIds.message}</p>
                ) : null}
              </div>
              <Checkbox disabled={readonly} label="Completed" {...register('taskCompleted')} />
            </>
          ) : null}
          {canManage ? (
            <label className="sm:col-span-2">
              Event image
              <input
                accept="image/jpeg,image/png,image/webp"
                type="file"
                onChange={async (event) => {
                  const file = event.currentTarget.files?.[0];
                  if (!file) return;
                  const uploaded = await onImageUpload(file);
                  if (!uploaded) return;
                  setValue('imageAssetId', uploaded.assetId);
                  setValue('imageUrl', uploaded.imageUrl);
                }}
              />
            </label>
          ) : null}
          {values.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt=""
              className="h-24 w-24 rounded-md border border-[var(--line)] object-cover"
              src={values.imageUrl}
            />
          ) : null}
        </form>
        <footer className="flex flex-wrap justify-between gap-2 border-t border-[var(--line)] p-5">
          <div>
            {mode === 'edit' && canManage ? (
              <Button type="button" variant="danger" onClick={onDelete}>
                Delete
              </Button>
            ) : null}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Close
            </Button>
            {canManage ? (
              <Button
                disabled={pending || isSubmitting}
                type="button"
                onClick={() => void submit()}
              >
                Save
              </Button>
            ) : null}
          </div>
        </footer>
      </div>
    </div>
  );
}
