'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { createManualOrganizationMemberSchema, MEMBER_MINISTRIES } from '@churchflow/shared';
import type { MemberMinistry } from '@churchflow/shared';
import { useTranslations } from 'next-intl';
import { useId, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'react-toastify';
import { z } from 'zod';
import { FormCheckbox } from '@/components/forms/form-checkbox';
import { FormDatePicker } from '@/components/forms/form-date-picker';
import { FormInput } from '@/components/forms/form-input';
import { FormSelect } from '@/components/forms/form-select';
import { FormTextarea } from '@/components/forms/form-textarea';
import { Button } from '@/components/ui/button';
import { createMemberAction } from '../actions';

const formSchema = createManualOrganizationMemberSchema.and(
  z.object({ prepareAccess: z.boolean().default(false) }),
);
type FormInput = z.input<typeof formSchema>;
type FormValues = z.output<typeof formSchema>;

interface CreatedMember {
  id: string;
  role: string;
  source: string;
  ministries: MemberMinistry[];
  profile: {
    displayName: string;
    email: string | null;
    phone: string | null;
    birthday: string | null;
    anniversary: string | null;
  };
}

export function CreateMemberDialog({
  organizationId,
  onCreated,
  triggerClassName,
}: {
  organizationId: string;
  onCreated: (member: CreatedMember) => void;
  triggerClassName?: string;
}) {
  const t = useTranslations('members');
  const commonT = useTranslations('common');
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(formSchema),
    mode: 'onBlur',
    reValidateMode: 'onChange',
    defaultValues: { role: 'MEMBER', prepareAccess: false, ministries: [] },
  });

  const submit = handleSubmit(async (values) => {
    const { prepareAccess, ...member } = values;
    const result = await createMemberAction({ organizationId, member, prepareAccess });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(t('createdMember'));
    onCreated(result.member);
    reset();
    dialogRef.current?.close();
  });

  return (
    <>
      <Button
        className={triggerClassName}
        type="button"
        onClick={() => dialogRef.current?.showModal()}
      >
        {t('createMember')}
      </Button>
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        className="fixed left-1/2 top-1/2 h-fit max-h-[min(800px,80dvh)] w-[min(520px,calc(100%-32px))] max-w-none -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] p-0 text-[var(--foreground)] shadow-[0_16px_48px_rgba(31,35,40,0.2)] backdrop:bg-[rgba(31,35,40,0.45)]"
      >
        <form
          className="grid max-h-[min(800px,80dvh)] grid-rows-[auto_minmax(0,1fr)_auto]"
          onSubmit={submit}
          noValidate
        >
          <header className="flex items-center justify-between border-b border-[var(--line)] p-5">
            <h2 id={titleId}>{t('addMemberManually')}</h2>
            <button
              aria-label={commonT('cancel')}
              className="h-8 w-8 cursor-pointer rounded-[var(--radius)] border-0 bg-transparent text-2xl text-[var(--muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]"
              type="button"
              onClick={() => dialogRef.current?.close()}
            >
              ×
            </button>
          </header>
          <div className="flex min-h-0 flex-col gap-4 overflow-y-auto p-5">
            <FormInput
              label={commonT('name')}
              error={errors.displayName?.message}
              {...register('displayName')}
            />
            <FormInput
              label={commonT('email')}
              type="email"
              error={errors.email?.message}
              {...register('email')}
            />
            <FormInput label={t('phone')} error={errors.phone?.message} {...register('phone')} />
            <FormSelect label={t('role')} error={errors.role?.message} {...register('role')}>
              <option value="MEMBER">{t('roleLabels.MEMBER')}</option>
              <option value="VIEWER">{t('roleLabels.VIEWER')}</option>
            </FormSelect>
            <fieldset className="grid gap-2 rounded-md border border-[var(--line)] p-3">
              <legend className="px-1 font-semibold">{t('ministries')}</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {MEMBER_MINISTRIES.map((ministry) => (
                  <FormCheckbox
                    key={ministry}
                    label={t(`ministry.${ministry}`)}
                    value={ministry}
                    {...register('ministries')}
                  />
                ))}
              </div>
            </fieldset>
            <FormDatePicker
              control={control}
              name="memberSince"
              label={t('memberSince')}
              error={errors.memberSince?.message}
            />
            <FormDatePicker
              control={control}
              name="birthday"
              label={t('birthday')}
              error={errors.birthday?.message}
            />
            <FormDatePicker
              control={control}
              name="anniversary"
              label={t('anniversary')}
              error={errors.anniversary?.message}
            />
            <FormTextarea
              label={t('notes')}
              rows={4}
              error={errors.notes?.message}
              {...register('notes')}
            />
            <FormTextarea
              label={t('biography')}
              rows={5}
              error={errors.biography?.message}
              {...register('biography')}
            />
            <FormTextarea
              label={t('familyNotes')}
              rows={4}
              error={errors.familyNotes?.message}
              {...register('familyNotes')}
            />
            <FormCheckbox label={t('prepareAppAccess')} {...register('prepareAccess')} />
          </div>
          <footer className="flex justify-end gap-2 border-t border-[var(--line)] p-5">
            <Button type="button" variant="secondary" onClick={() => dialogRef.current?.close()}>
              {commonT('cancel')}
            </Button>
            <Button disabled={isSubmitting} type="submit">
              {isSubmitting ? t('creating') : t('createMember')}
            </Button>
          </footer>
        </form>
      </dialog>
    </>
  );
}
