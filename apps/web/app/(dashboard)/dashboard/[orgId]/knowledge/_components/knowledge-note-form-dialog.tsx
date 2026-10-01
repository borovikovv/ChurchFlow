'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useId, useRef, type RefObject } from 'react';
import { useForm } from 'react-hook-form';
import {
  KNOWLEDGE_CATEGORIES,
  KNOWLEDGE_TITLE_MAX_LENGTH,
  type CreateKnowledgeEntryInput,
  type KnowledgeEntryItem,
  type KnowledgeVisibility,
} from '@churchflow/shared';
import { FormCheckbox } from '@/components/forms/form-checkbox';
import { FormInput } from '@/components/forms/form-input';
import { FormRichTextEditor } from '@/components/forms/form-rich-text-editor';
import { FormSelect } from '@/components/forms/form-select';
import { Button } from '@/components/ui/button';
import { FormDialog } from '@/components/ui/form-dialog';
import {
  knowledgeNoteFormSchema,
  knowledgeNoteFormValues,
  type KnowledgeNoteFormValues,
} from '../knowledge-forms';

export function KnowledgeNoteFormDialog({
  assignableVisibilities,
  dialogRef: externalDialogRef,
  entry,
  title,
  triggerClassName,
  triggerLabel,
  onClose,
  onSubmit,
}: {
  assignableVisibilities: KnowledgeVisibility[];
  dialogRef?: RefObject<HTMLDialogElement | null>;
  entry?: KnowledgeEntryItem;
  title: string;
  triggerClassName?: string;
  triggerLabel?: string;
  onClose?: () => void;
  onSubmit: (entry: CreateKnowledgeEntryInput, closeDialog: () => void) => void;
}) {
  const t = useTranslations('knowledge');
  const internalDialogRef = useRef<HTMLDialogElement>(null);
  const dialogRef = externalDialogRef ?? internalDialogRef;
  const formId = useId();
  const defaultVisibility = assignableVisibilities[0] ?? 'MEMBERS';
  const {
    control,
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<KnowledgeNoteFormValues, unknown, CreateKnowledgeEntryInput>({
    resolver: zodResolver(knowledgeNoteFormSchema),
    mode: 'onBlur',
    reValidateMode: 'onChange',
    defaultValues: knowledgeNoteFormValues(entry, defaultVisibility),
  });
  const resetForm = () => reset(knowledgeNoteFormValues(entry, defaultVisibility));

  const submit = handleSubmit((values) => {
    onSubmit(values, () => dialogRef.current?.close());
  });

  return (
    <FormDialog
      dialogRef={dialogRef}
      fullScreenOnMobile
      size="lg"
      title={title}
      triggerVariant="ghost"
      onOpen={resetForm}
      onClose={() => {
        // A dialog opened from the add menu has no trigger to reset it, so it resets on close.
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
            {entry ? t('save') : t('create')}
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
        <div className="grid gap-3 md:grid-cols-2">
          <FormSelect
            label={t('categoryLabel')}
            error={errors.category?.message}
            value={watch('category')}
            {...register('category')}
          >
            {KNOWLEDGE_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {t(`categories.${category}`)}
              </option>
            ))}
          </FormSelect>
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
        </div>
        <FormInput
          label={t('tagsLabel')}
          error={errors.tags?.message}
          placeholder={t('tagsHint')}
          {...register('tags')}
        />
        <FormRichTextEditor
          control={control}
          name="content"
          label={t('contentLabel')}
          error={errors.content?.message}
        />
        <FormCheckbox label={t('pinnedLabel')} {...register('pinned')} />
      </form>
    </FormDialog>
  );
}
