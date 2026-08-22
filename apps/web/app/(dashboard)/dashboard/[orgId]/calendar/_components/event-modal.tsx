'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState } from 'react';
import {
  useForm,
  type UseFormClearErrors,
  type UseFormRegister,
  type UseFormSetValue,
} from 'react-hook-form';
import { toast } from 'react-toastify';
import type {
  CalendarEventItem,
  CalendarEventType,
  CalendarMemberOption,
  MemberMinistry,
} from '@churchflow/shared';
import {
  CALENDAR_EVENT_REPEAT_PERIODS,
  CALENDAR_EVENT_TYPES,
  MEMBER_MINISTRY,
} from '@churchflow/shared';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { FormDialog } from '@/components/ui/form-dialog';
import { FormDatePicker } from '@/components/forms/form-date-picker';
import { FormInput } from '@/components/forms/form-input';
import { FormSelect } from '@/components/forms/form-select';
import { FormTextarea } from '@/components/forms/form-textarea';
import { CALENDAR_TYPE } from './calendar-constants';
import type { CalendarFormState } from './calendar-types';
import { applyFormValues, autofillMemberEvent, validateCalendarForm } from './calendar-form-utils';

const REMINDER_VALUES = ['', 'ONE_HOUR', 'ONE_DAY', 'ONE_WEEK'] as const;

const SERVICE_ROLE_PRIORITIES: Record<
  'preacher' | 'serviceHost' | 'worshipLead' | 'communionLead',
  MemberMinistry[]
> = {
  preacher: [MEMBER_MINISTRY.preaching],
  serviceHost: [MEMBER_MINISTRY.minister, MEMBER_MINISTRY.deacon, MEMBER_MINISTRY.teacher],
  worshipLead: [MEMBER_MINISTRY.worship],
  communionLead: [MEMBER_MINISTRY.deacon, MEMBER_MINISTRY.minister],
};

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
  const t = useTranslations('calendar');
  const readonly = !canManage;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formId = useId();
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
    if (
      !validateCalendarForm(nextValues, setError, {
        assigneeRequired: t('validation.assigneeRequired'),
        endDateAfterStart: t('validation.endDateAfterStart'),
        servicePersonRequired: t('validation.servicePersonRequired'),
        servicePersonSingleValue: t('validation.servicePersonSingleValue'),
        startDateRequired: t('validation.startDateRequired'),
        startTimeRequired: t('validation.startTimeRequired'),
        titleRequired: t('validation.titleRequired'),
      })
    ) {
      return;
    }
    const result = await onSubmit(nextValues);
    if (!result.ok) {
      toast.error(result.error);
    }
  });

  // The parent mounts this component only while the modal is open, so the native dialog has to be
  // pushed into the top layer on mount. Remounting also keeps `defaultValues` in sync with `form`.
  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  return (
    <FormDialog
      dialogRef={dialogRef}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:w-full sm:flex-row sm:items-center sm:justify-between">
          <div>
            {mode === 'edit' && canManage ? (
              <Button type="button" variant="danger" onClick={onDelete}>
                {t('delete')}
              </Button>
            ) : null}
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button type="button" variant="secondary" onClick={() => dialogRef.current?.close()}>
              {t('close')}
            </Button>
            {canManage ? (
              <Button disabled={pending || isSubmitting} form={formId} type="submit">
                {t('save')}
              </Button>
            ) : null}
          </div>
        </div>
      }
      fullScreenOnMobile
      size="lg"
      title={mode === 'create' ? t('newEvent') : (editingEvent?.title ?? t('event'))}
      onClose={onClose}
    >
      <form className="grid gap-4 sm:grid-cols-2" id={formId} onSubmit={submit} noValidate>
        <FormSelect
          disabled={readonly}
          error={errors.type?.message}
          label={t('type')}
          value={values.type}
          {...register('type', {
            onChange: (event) => {
              const next = autofillMemberEvent(
                { ...values, type: event.currentTarget.value as CalendarEventType },
                members,
                {
                  anniversary: (name) => t('autofill.anniversary', { name }),
                  birthday: (name) => t('autofill.birthday', { name }),
                },
              );
              applyFormValues(next, setValue);
            },
          })}
        >
          {CALENDAR_EVENT_TYPES.map((value) => (
            <option key={value} value={value}>
              {t(`eventTypes.${value}`)}
            </option>
          ))}
        </FormSelect>
        <FormSelect
          disabled={readonly}
          error={errors.linkedMembershipId?.message}
          label={t('linkedMember')}
          value={values.linkedMembershipId}
          {...register('linkedMembershipId', {
            onChange: (event) => {
              const next = autofillMemberEvent(
                { ...values, linkedMembershipId: event.currentTarget.value },
                members,
                {
                  anniversary: (name) => t('autofill.anniversary', { name }),
                  birthday: (name) => t('autofill.birthday', { name }),
                },
              );
              applyFormValues(next, setValue);
            },
          })}
        >
          <option value="">{t('noLinkedMember')}</option>
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
            label={t('titleField')}
            {...register('title')}
          />
        </div>
        <div className="sm:col-span-2">
          <FormTextarea
            disabled={readonly}
            error={errors.description?.message}
            label={t('description')}
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
          label={t('startDate')}
        />
        <FormInput
          disabled={readonly || values.allDay}
          error={errors.startTime?.message}
          label={t('startTime')}
          type="time"
          {...register('startTime')}
        />
        <FormDatePicker
          control={control}
          disabled={readonly}
          error={errors.endDate?.message}
          maxDate={null}
          name="endDate"
          label={t('endDate')}
        />
        <FormInput
          disabled={readonly || values.allDay}
          error={errors.endTime?.message}
          label={t('endTime')}
          type="time"
          {...register('endTime')}
        />
        <Checkbox disabled={readonly} label={t('fullDay')} {...register('allDay')} />
        <FormSelect
          disabled={readonly}
          error={errors.reminder?.message}
          label={t('reminder')}
          value={values.reminder}
          {...register('reminder', {
            onChange: (event) => {
              setValue('reminder', event.currentTarget.value as CalendarFormState['reminder'], {
                shouldDirty: true,
                shouldValidate: true,
              });
              clearErrors('reminder');
            },
          })}
        >
          {REMINDER_VALUES.map((value) => (
            <option key={value || 'none'} value={value}>
              {value ? t(`reminders.${value}`) : t('reminders.NONE')}
            </option>
          ))}
        </FormSelect>
        <FormSelect
          disabled={readonly}
          error={errors.repeatPeriod?.message}
          label={t('repeat')}
          value={values.repeatPeriod}
          {...register('repeatPeriod', {
            onChange: (event) => {
              setValue(
                'repeatPeriod',
                event.currentTarget.value as CalendarFormState['repeatPeriod'],
                {
                  shouldDirty: true,
                  shouldValidate: true,
                },
              );
              clearErrors('repeatPeriod');
            },
          })}
        >
          {CALENDAR_EVENT_REPEAT_PERIODS.map((value) => (
            <option key={value} value={value}>
              {t(`repeatPeriods.${value}`)}
            </option>
          ))}
        </FormSelect>
        {values.type === CALENDAR_TYPE.task ? (
          <>
            <div className="grid gap-2 sm:col-span-2">
              <div className="grid items-end gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                <FormSelect
                  disabled={readonly || availableAssignees.length === 0}
                  label={t('assignees')}
                  value={assigneeToAdd}
                  onChange={(event) => setAssigneeToAdd(event.currentTarget.value)}
                >
                  <option value="">{t('selectMember')}</option>
                  {availableAssignees.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.displayName}
                    </option>
                  ))}
                </FormSelect>
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
                  {t('add')}
                </Button>
              </div>
              {selectedAssignees.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {selectedAssignees.map((member) => (
                    <span
                      className="inline-flex items-center gap-2 rounded-md border border-[var(--line)] bg-[var(--surface-subtle)] px-2 py-1 text-sm"
                      key={member.id}
                    >
                      {member.displayName}
                      <button
                        aria-label={t('removeAssignee', { name: member.displayName })}
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
            <Checkbox disabled={readonly} label={t('completed')} {...register('taskCompleted')} />
          </>
        ) : null}
        {values.type === CALENDAR_TYPE.service ? (
          <fieldset className="grid items-start gap-4 rounded-md border border-[var(--line)] p-4 sm:col-span-2 sm:grid-cols-2">
            <legend className="px-1 font-semibold">{t('serviceDetails')}</legend>
            <ServiceRoleField
              disabled={readonly}
              error={errors.serviceDetails?.preacher?.message}
              label={t('preacher')}
              members={members}
              role="preacher"
              values={values.serviceDetails.preacher}
              register={register}
              setValue={setValue}
              clearErrors={clearErrors}
            />
            <ServiceRoleField
              disabled={readonly}
              error={errors.serviceDetails?.serviceHost?.message}
              label={t('serviceHost')}
              members={members}
              role="serviceHost"
              values={values.serviceDetails.serviceHost}
              register={register}
              setValue={setValue}
              clearErrors={clearErrors}
            />
            <ServiceRoleField
              disabled={readonly}
              error={errors.serviceDetails?.worshipLead?.message}
              label={t('worshipLead')}
              members={members}
              role="worshipLead"
              values={values.serviceDetails.worshipLead}
              register={register}
              setValue={setValue}
              clearErrors={clearErrors}
            />
            <div className="self-start">
              <FormTextarea
                disabled={readonly}
                error={errors.serviceDetails?.biblePassage?.message}
                className="min-h-31"
                label={t('biblePassage')}
                {...register('serviceDetails.biblePassage')}
              />
            </div>
            <div className="self-start pt-1">
              <Checkbox
                disabled={readonly}
                label={t('communion')}
                {...register('serviceDetails.hasCommunion')}
              />
            </div>
            <div className="min-h-[150px]">
              {values.serviceDetails.hasCommunion ? (
                <ServiceRoleField
                  disabled={readonly}
                  error={errors.serviceDetails?.communionLead?.message}
                  label={t('communionLead')}
                  members={members}
                  role="communionLead"
                  values={values.serviceDetails.communionLead}
                  register={register}
                  setValue={setValue}
                  clearErrors={clearErrors}
                />
              ) : null}
            </div>
            <div className="sm:col-span-2">
              <FormTextarea
                disabled={readonly}
                error={errors.serviceDetails?.songs?.message}
                label={t('songs')}
                rows={4}
                placeholder={t('songsPlaceholder')}
                {...register('serviceDetails.songs')}
              />
            </div>
          </fieldset>
        ) : null}
        {canManage ? (
          <label className="sm:col-span-2">
            {t('eventImage')}
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
    </FormDialog>
  );
}

function ServiceRoleField({
  disabled,
  error,
  label,
  members,
  role,
  values,
  register,
  setValue,
  clearErrors,
}: {
  disabled: boolean;
  error?: string | undefined;
  label: string;
  members: CalendarMemberOption[];
  role: 'preacher' | 'serviceHost' | 'worshipLead' | 'communionLead';
  values: CalendarFormState['serviceDetails']['preacher'];
  register: UseFormRegister<CalendarFormState>;
  setValue: UseFormSetValue<CalendarFormState>;
  clearErrors: UseFormClearErrors<CalendarFormState>;
}) {
  const t = useTranslations('calendar');
  const sortedMembers = sortMembersByMinistry(members, SERVICE_ROLE_PRIORITIES[role]);
  const baseName = `serviceDetails.${role}` as const;

  return (
    <div className="grid gap-2">
      <FormSelect
        clearable
        disabled={disabled}
        error={error}
        label={label}
        name={`${baseName}.membershipId`}
        value={values.membershipId}
        onChange={(event) => {
          const nextMembershipId = event.currentTarget.value;
          setValue(`${baseName}.membershipId`, nextMembershipId, {
            shouldDirty: true,
            shouldValidate: true,
          });
          if (nextMembershipId) {
            setValue(`${baseName}.customName`, '', { shouldDirty: true, shouldValidate: true });
          }
          clearErrors(baseName);
        }}
      >
        <option value="">{t('noMemberSelected')}</option>
        {sortedMembers.map((member) => (
          <option key={member.id} value={member.id}>
            {member.displayName}
          </option>
        ))}
      </FormSelect>
      <FormInput
        disabled={disabled || Boolean(values.membershipId)}
        label={t('guestLabel', { label })}
        placeholder={values.membershipId ? t('clearMemberForGuest') : t('guestName')}
        {...register(`${baseName}.customName`, {
          onChange: (event) => {
            if (event.currentTarget.value.trim()) {
              setValue(`${baseName}.membershipId`, '', {
                shouldDirty: true,
                shouldValidate: true,
              });
            }
            clearErrors(baseName);
          },
        })}
      />
    </div>
  );
}

function sortMembersByMinistry(members: CalendarMemberOption[], priorities: MemberMinistry[]) {
  return [...members].sort((left, right) => {
    const leftRank = ministryRank(left.ministries, priorities);
    const rightRank = ministryRank(right.ministries, priorities);
    if (leftRank !== rightRank) return leftRank - rightRank;
    return left.displayName.localeCompare(right.displayName);
  });
}

function ministryRank(ministries: MemberMinistry[], priorities: MemberMinistry[]) {
  const rank = priorities.findIndex((ministry) => ministries.includes(ministry));
  return rank === -1 ? Number.MAX_SAFE_INTEGER : rank;
}
