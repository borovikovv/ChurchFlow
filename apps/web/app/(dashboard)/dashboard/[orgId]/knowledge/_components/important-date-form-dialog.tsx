'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useLocale, useTranslations } from 'next-intl';
import { useId, useMemo, useRef, type ReactNode, type RefObject } from 'react';
import { Controller, useForm, type Control } from 'react-hook-form';
import {
  IMPORTANT_DATE_NOTES_MAX_LENGTH,
  IMPORTANT_DATE_NTH_VALUES,
  IMPORTANT_DATE_REMINDER_MAX_DAYS,
  IMPORTANT_DATE_RULE_KINDS,
  KNOWLEDGE_TITLE_MAX_LENGTH,
  createImportantDateSchema,
  type CreateImportantDateFormInput,
  type CreateImportantDateInput,
  type ImportantDateItem,
  type KnowledgeVisibility,
} from '@churchflow/shared';
import { FormInput } from '@/components/forms/form-input';
import { FormSelect } from '@/components/forms/form-select';
import { FormTextarea } from '@/components/forms/form-textarea';
import { Button, type ButtonVariant } from '@/components/ui/button';
import { FormDialog } from '@/components/ui/form-dialog';
import { monthNames, weekdayNames } from '@/lib/calendar-names';
import { ORDINAL_KEYS } from '../important-date-format';
import { importantDateFormValues, optionalNumber, ruleFieldsFor } from '../knowledge-forms';

const DAY_OPTIONS = Array.from({ length: 31 }, (_, index) => ({
  label: String(index + 1),
  value: index + 1,
}));

interface NumberOption {
  label: string;
  value: number;
}

export function ImportantDateFormDialog({
  assignableVisibilities,
  date,
  dialogRef: externalDialogRef,
  title,
  triggerClassName,
  triggerLabel,
  triggerVariant = 'ghost',
  onClose,
  onSubmit,
}: {
  assignableVisibilities: KnowledgeVisibility[];
  date?: ImportantDateItem;
  dialogRef?: RefObject<HTMLDialogElement | null>;
  title: string;
  triggerClassName?: string;
  triggerLabel?: ReactNode;
  triggerVariant?: ButtonVariant;
  onClose?: () => void;
  onSubmit: (date: CreateImportantDateInput, closeDialog: () => void) => void;
}) {
  const t = useTranslations('knowledge');
  const locale = useLocale();
  const internalDialogRef = useRef<HTMLDialogElement>(null);
  const dialogRef = externalDialogRef ?? internalDialogRef;
  const formId = useId();
  const monthOptions = useMemo(
    () => monthNames(locale).map((label, index) => ({ label, value: index + 1 })),
    [locale],
  );
  const weekdayOptions = useMemo(
    () => weekdayNames(locale).map((label, value) => ({ label, value })),
    [locale],
  );
  const nthOptions = IMPORTANT_DATE_NTH_VALUES.map((value) => ({
    label: t(`nthOptions.${ORDINAL_KEYS[value]}`),
    value,
  }));
  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CreateImportantDateFormInput, unknown, CreateImportantDateInput>({
    resolver: zodResolver(createImportantDateSchema),
    mode: 'onBlur',
    reValidateMode: 'onChange',
    defaultValues: importantDateFormValues(date, assignableVisibilities),
  });
  const ruleKind = watch('ruleKind');
  const resetForm = () => reset(importantDateFormValues(date, assignableVisibilities));

  const submit = handleSubmit((values) => {
    onSubmit(values, () => dialogRef.current?.close());
  });

  return (
    <FormDialog
      dialogRef={dialogRef}
      fullScreenOnMobile
      size="md"
      title={title}
      triggerVariant={triggerVariant}
      onOpen={resetForm}
      onClose={() => {
        resetForm();
        onClose?.();
      }}
      {...(triggerLabel ? { triggerLabel } : {})}
      {...(triggerClassName ? { triggerClassName } : {})}
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => dialogRef.current?.close()}>
            {t('cancel')}
          </Button>
          <Button type="submit" form={formId} disabled={isSubmitting}>
            {date ? t('save') : t('create')}
          </Button>
        </div>
      }
    >
      <form className="stack" id={formId} onSubmit={submit} noValidate>
        <FormInput
          label={t('titleLabel')}
          error={errors.title?.message}
          maxLength={KNOWLEDGE_TITLE_MAX_LENGTH}
          {...register('title')}
        />
        <FormSelect
          label={t('ruleKindLabel')}
          error={errors.ruleKind?.message}
          value={ruleKind}
          {...register('ruleKind', {
            onChange: (event: { target: { value: string } }) => {
              const fields = ruleFieldsFor(
                event.target.value === 'NTH_WEEKDAY' ? 'NTH_WEEKDAY' : 'FIXED',
              );
              setValue('day', fields.day);
              setValue('weekday', fields.weekday);
              setValue('nth', fields.nth);
            },
          })}
        >
          {IMPORTANT_DATE_RULE_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {t(`ruleKinds.${kind}`)}
            </option>
          ))}
        </FormSelect>
        <div className="grid gap-3 md:grid-cols-3">
          {ruleKind === 'NTH_WEEKDAY' ? (
            <>
              <NumberSelectField
                control={control}
                error={errors.nth?.message}
                label={t('nthLabel')}
                name="nth"
                options={nthOptions}
              />
              <NumberSelectField
                control={control}
                error={errors.weekday?.message}
                label={t('weekdayLabel')}
                name="weekday"
                options={weekdayOptions}
              />
            </>
          ) : (
            <NumberSelectField
              control={control}
              error={errors.day?.message}
              label={t('dayLabel')}
              name="day"
              options={DAY_OPTIONS}
            />
          )}
          <NumberSelectField
            control={control}
            error={errors.month?.message}
            label={t('monthLabel')}
            name="month"
            options={monthOptions}
          />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <FormSelect
            label={t('visibilityLabel')}
            error={errors.visibility?.message}
            value={watch('visibility')}
            {...register('visibility')}
          >
            {assignableVisibilities.map((visibility) => (
              <option key={visibility} value={visibility}>
                {t(`visibilities.${visibility}`)}
              </option>
            ))}
          </FormSelect>
          <FormInput
            label={t('reminderLabel')}
            error={errors.reminderLeadDays?.message}
            inputMode="numeric"
            max={IMPORTANT_DATE_REMINDER_MAX_DAYS}
            min={0}
            type="number"
            {...register('reminderLeadDays', { setValueAs: optionalNumber })}
          />
        </div>
        <FormTextarea
          label={t('notesLabel')}
          error={errors.notes?.message}
          maxLength={IMPORTANT_DATE_NOTES_MAX_LENGTH}
          rows={4}
          {...register('notes')}
        />
      </form>
    </FormDialog>
  );
}

function NumberSelectField({
  control,
  error,
  label,
  name,
  options,
}: {
  control: Control<CreateImportantDateFormInput, unknown, CreateImportantDateInput>;
  error: string | undefined;
  label: string;
  name: 'day' | 'month' | 'nth' | 'weekday';
  options: NumberOption[];
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <FormSelect
          label={label}
          error={error}
          name={field.name}
          value={String(field.value ?? '')}
          onBlur={field.onBlur}
          onChange={(event) => field.onChange(optionalNumber(event.target.value))}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </FormSelect>
      )}
    />
  );
}
