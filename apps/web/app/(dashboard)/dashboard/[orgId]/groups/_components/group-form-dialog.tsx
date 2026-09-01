'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useRef } from 'react';
import { Controller, useForm } from 'react-hook-form';
import type { CreateOrganizationGroupInput, OrganizationGroupBadge } from '@churchflow/shared';
import {
  createOrganizationGroupSchema,
  DEFAULT_ORGANIZATION_GROUP_COLOR,
  DEFAULT_ORGANIZATION_GROUP_ICON,
  ORGANIZATION_GROUP_ICONS,
} from '@churchflow/shared';
import { FormInput } from '@/components/forms/form-input';
import { FormTextarea } from '@/components/forms/form-textarea';
import { GROUP_ICON_COMPONENTS } from '@/components/icons/group-icons';
import { Button } from '@/components/ui/button';
import { FormDialog } from '@/components/ui/form-dialog';
import { GROUP_COLOR_PRESETS, groupForegroundColor } from '@/features/groups/lib/group-color';
import { colorSwatchClassName, iconOptionClassName } from './group-form-dialog.styles';

export function GroupFormDialog({
  group,
  submitLabel,
  title,
  triggerClassName,
  triggerLabel,
  triggerVariant,
  onSubmit,
}: {
  group?: OrganizationGroupBadge & { description: string | null };
  submitLabel: string;
  title: string;
  triggerClassName?: string;
  triggerLabel: string;
  triggerVariant?: 'primary' | 'secondary' | 'ghost';
  onSubmit: (group: CreateOrganizationGroupInput, closeDialog: () => void) => void;
}) {
  const t = useTranslations('groups');
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formId = `group-form-${group?.id ?? 'new'}`;
  const defaultValues = {
    name: group?.name ?? '',
    description: group?.description ?? '',
    icon: group?.icon ?? DEFAULT_ORGANIZATION_GROUP_ICON,
    color: group?.color ?? DEFAULT_ORGANIZATION_GROUP_COLOR,
  };
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateOrganizationGroupInput>({
    resolver: zodResolver(createOrganizationGroupSchema),
    mode: 'onBlur',
    reValidateMode: 'onChange',
    defaultValues,
  });

  const submit = handleSubmit((values) => {
    onSubmit(values, () => dialogRef.current?.close());
  });

  return (
    <FormDialog
      dialogRef={dialogRef}
      fullScreenOnMobile
      title={title}
      triggerLabel={triggerLabel}
      triggerVariant={triggerVariant ?? (group ? 'ghost' : 'primary')}
      onOpen={() => reset(defaultValues)}
      {...(triggerClassName ? { triggerClassName } : {})}
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => dialogRef.current?.close()}>
            {t('cancel')}
          </Button>
          <Button type="submit" form={formId} disabled={isSubmitting}>
            {submitLabel}
          </Button>
        </div>
      }
    >
      <form className="stack" id={formId} onSubmit={submit} noValidate>
        <FormInput
          label={t('nameLabel')}
          placeholder={t('namePlaceholder')}
          error={errors.name?.message}
          {...register('name')}
        />
        <FormTextarea
          label={t('descriptionLabel')}
          rows={3}
          error={errors.description?.message}
          {...register('description')}
        />

        <Controller
          control={control}
          name="icon"
          render={({ field }) => (
            <fieldset className="grid gap-2 rounded-[var(--radius)] border border-[var(--line)] p-3">
              <legend className="px-1 font-semibold">{t('iconLabel')}</legend>
              <div className="grid grid-cols-6 gap-2 sm:grid-cols-8">
                {ORGANIZATION_GROUP_ICONS.map((icon) => {
                  const GroupIcon = GROUP_ICON_COMPONENTS[icon];
                  const selected = field.value === icon;

                  return (
                    <button
                      aria-label={t(`icons.${icon}`)}
                      aria-pressed={selected}
                      className={iconOptionClassName({ selected })}
                      key={icon}
                      title={t(`icons.${icon}`)}
                      type="button"
                      onClick={() => field.onChange(icon)}
                    >
                      <GroupIcon className="h-5 w-5" />
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}
        />

        <Controller
          control={control}
          name="color"
          render={({ field }) => (
            <fieldset className="grid gap-2 rounded-[var(--radius)] border border-[var(--line)] p-3">
              <legend className="px-1 font-semibold">{t('colorLabel')}</legend>
              <div className="flex flex-wrap items-center gap-2">
                {GROUP_COLOR_PRESETS.map((color) => {
                  const selected = field.value.toUpperCase() === color;

                  return (
                    <button
                      aria-label={color}
                      aria-pressed={selected}
                      className={colorSwatchClassName({ selected })}
                      key={color}
                      style={{ backgroundColor: color, color: groupForegroundColor(color) }}
                      type="button"
                      onClick={() => field.onChange(color)}
                    >
                      {selected ? '✓' : ''}
                    </button>
                  );
                })}
                <input
                  aria-label={t('customColorLabel')}
                  className="h-9 w-12 cursor-pointer rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] p-1"
                  type="color"
                  value={field.value}
                  onChange={(event) => field.onChange(event.target.value.toUpperCase())}
                />
              </div>
              {errors.color?.message ? (
                <small className="form-error">{errors.color.message}</small>
              ) : null}
            </fieldset>
          )}
        />
      </form>
    </FormDialog>
  );
}
