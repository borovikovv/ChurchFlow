'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { createManualOrganizationMemberSchema } from '@churchflow/shared';
import { useId, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'react-toastify';
import { z } from 'zod';
import { FormDatePicker } from '@/components/forms/form-date-picker';
import { FormField } from '@/components/forms/form-field';
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
  profile: { displayName: string; email: string | null; phone: string | null };
}

export function CreateMemberDialog({
  organizationId,
  onCreated,
}: {
  organizationId: string;
  onCreated: (member: CreatedMember) => void;
}) {
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
    defaultValues: { role: 'MEMBER', prepareAccess: false },
  });

  const submit = handleSubmit(async (values) => {
    const { prepareAccess, ...member } = values;
    const result = await createMemberAction({ organizationId, member, prepareAccess });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success('Member created.');
    onCreated(result.member);
    reset();
    dialogRef.current?.close();
  });

  return (
    <>
      <Button type="button" onClick={() => dialogRef.current?.showModal()}>
        Add new member
      </Button>
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        className="fixed inset-0 m-auto max-h-[min(800px,80dvh)] w-[min(520px,calc(100%-32px))] max-w-none rounded-xl border border-[var(--line)] bg-[var(--surface)] p-0 text-[var(--foreground)] shadow-[0_16px_48px_rgba(31,35,40,0.2)] backdrop:bg-[rgba(31,35,40,0.45)]"
      >
        <form
          className="grid max-h-[min(800px,80dvh)] grid-rows-[auto_minmax(0,1fr)_auto]"
          onSubmit={submit}
          noValidate
        >
          <header className="flex items-center justify-between border-b border-[var(--line)] p-5">
            <h2 id={titleId}>Add member manually</h2>
            <button
              aria-label="Close"
              className="text-2xl text-[var(--muted)]"
              type="button"
              onClick={() => dialogRef.current?.close()}
            >
              ×
            </button>
          </header>
          <div className="flex flex-col min-h-0 overflow-y-auto gap-4 p-5">
            <FormField label="Name" error={errors.displayName?.message}>
              {({ id, errorId, invalid }) => (
                <input
                  id={id}
                  aria-describedby={errorId}
                  aria-invalid={invalid}
                  {...register('displayName')}
                />
              )}
            </FormField>
            <FormField label="Email" error={errors.email?.message}>
              {({ id, errorId, invalid }) => (
                <input
                  id={id}
                  type="email"
                  aria-describedby={errorId}
                  aria-invalid={invalid}
                  {...register('email')}
                />
              )}
            </FormField>
            <FormField label="Phone" error={errors.phone?.message}>
              {({ id, errorId, invalid }) => (
                <input
                  id={id}
                  aria-describedby={errorId}
                  aria-invalid={invalid}
                  {...register('phone')}
                />
              )}
            </FormField>
            <FormField label="Role" error={errors.role?.message}>
              {({ id, errorId, invalid }) => (
                <select
                  id={id}
                  aria-describedby={errorId}
                  aria-invalid={invalid}
                  {...register('role')}
                >
                  <option value="MEMBER">Member</option>
                  <option value="VIEWER">Viewer</option>
                </select>
              )}
            </FormField>
            <FormDatePicker
              control={control}
              name="memberSince"
              label="Member since"
              error={errors.memberSince?.message}
            />
            <FormField label="Notes" error={errors.notes?.message}>
              {({ id, errorId, invalid }) => (
                <textarea
                  id={id}
                  rows={4}
                  aria-describedby={errorId}
                  aria-invalid={invalid}
                  {...register('notes')}
                />
              )}
            </FormField>
            <FormField label="Biography" error={errors.biography?.message}>
              {({ id, errorId, invalid }) => (
                <textarea
                  id={id}
                  rows={5}
                  aria-describedby={errorId}
                  aria-invalid={invalid}
                  {...register('biography')}
                />
              )}
            </FormField>
            <FormField label="Family notes" error={errors.familyNotes?.message}>
              {({ id, errorId, invalid }) => (
                <textarea
                  id={id}
                  rows={4}
                  aria-describedby={errorId}
                  aria-invalid={invalid}
                  {...register('familyNotes')}
                />
              )}
            </FormField>
            <label className="flex items-center gap-2">
              <input className="min-h-0 w-auto" type="checkbox" {...register('prepareAccess')} />
              Prepare app access after adding
            </label>
          </div>
          <footer className="flex justify-end gap-2 border-t border-[var(--line)] p-5">
            <Button type="button" variant="secondary" onClick={() => dialogRef.current?.close()}>
              Cancel
            </Button>
            <Button disabled={isSubmitting} type="submit">
              {isSubmitting ? 'Creating…' : 'Create member'}
            </Button>
          </footer>
        </form>
      </dialog>
    </>
  );
}
