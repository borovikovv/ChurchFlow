'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useLocale, useTranslations } from 'next-intl';
import { useId, useMemo, useRef, type RefObject } from 'react';
import { useForm } from 'react-hook-form';
import {
  IMPORTANT_DATE_NOTES_MAX_LENGTH,
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
import { Button } from '@/components/ui/button';
import { FormDialog } from '@/components/ui/form-dialog';
import { monthNames, weekdayNames } from '../important-date-format';
import { importantDateFormValues, optionalNumber, ruleFieldsFor } from '../knowledge-forms';

const NTH_OPTIONS = [
  { value: 1, key: 'first' },
  { value: 2, key: 'second' },
  { value: 3, key: 'third' },
  { value: 4, key: 'fourth' },
  { value: -1, key: 'last' },
] as const;

const DAYS = Array.from({ length: 31 }, (_, index) => index + 1);

export function ImportantDateFormDialog({
  assignableVisibilities,
  date,
  dialogRef: externalDialogRef,
  title,
  triggerClassName,
  triggerLabel,
  onClose,
  onSubmit,
}: {
  assignableVisibilities: KnowledgeVisibility[];
  date?: ImportantDateItem;
  dialogRef?: RefObject<HTMLDialogElement | null>;
  title: string;
  triggerClassName?: string;
  triggerLabel?: string;
  onClose?: () => void;
  onSubmit: (date: CreateImportantDateInput, closeDialog: () => void) => void;
}) {
  const t = useTranslations('knowledge');
  const locale = useLocale();
  const internalDialogRef = useRef<HTMLDialogElement>(null);
  const dialogRef = externalDialogRef ?? internalDialogRef;
  const formId = useId();
  const defaultVisibility = assignableVisibilities[0] ?? 'MEMBERS';
  const months = useMemo(() => monthNames(locale), [locale]);
  const weekdays = useMemo(() => weekdayNames(locale), [locale]);
  const {
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
    defaultValues: importantDateFormValues(date, defaultVisibility),
  });
  const ruleKind = watch('ruleKind');
  const resetForm = () => reset(importantDateFormValues(date, defaultVisibility));
  const numberField = { setValueAs: optionalNumber };

  const submit = handleSubmit((values) => {
    onSubmit(values, () => dialogRef.current?.close());
  });

  return (
    <FormDialog
      dialogRef={dialogRef}
      fullScreenOnMobile
      size="md"
      title={title}
      triggerVariant="ghost"
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
              <FormSelect
                label={t('nthLabel')}
                error={errors.nth?.message}
                value={String(watch('nth') ?? '')}
                {...register('nth', numberField)}
              >
                {NTH_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {t(`nthOptions.${option.key}`)}
                  </option>
                ))}
              </FormSelect>
              <FormSelect
                label={t('weekdayLabel')}
                error={errors.weekday?.message}
                value={String(watch('weekday') ?? '')}
                {...register('weekday', numberField)}
              >
                {weekdays.map((name, index) => (
                  <option key={name} value={index}>
                    {name}
                  </option>
                ))}
              </FormSelect>
            </>
          ) : (
            <FormSelect
              label={t('dayLabel')}
              error={errors.day?.message}
              value={String(watch('day') ?? '')}
              {...register('day', numberField)}
            >
              {DAYS.map((day) => (
                <option key={day} value={day}>
                  {day}
                </option>
              ))}
            </FormSelect>
          )}
          <FormSelect
            label={t('monthLabel')}
            error={errors.month?.message}
            value={String(watch('month'))}
            {...register('month', { setValueAs: Number })}
          >
            {months.map((name, index) => (
              <option key={name} value={index + 1}>
                {name}
              </option>
            ))}
          </FormSelect>
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
            {...register('reminderLeadDays', numberField)}
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
