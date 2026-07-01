'use client';

import { useId, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { Button, type ButtonVariant } from '@/components/ui/button';

export function ConfirmSubmitButton({
  triggerLabel,
  title,
  description,
  confirmLabel,
  variant = 'secondary',
  confirmVariant = variant,
  name,
  value,
  triggerClassName,
}: {
  triggerLabel: string;
  title: string;
  description: string;
  confirmLabel: string;
  variant?: ButtonVariant;
  confirmVariant?: ButtonVariant;
  name?: string;
  value?: string;
  triggerClassName?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const { pending } = useFormStatus();

  return (
    <>
      <Button
        className={triggerClassName}
        disabled={pending}
        onClick={(event) => {
          const form = event.currentTarget.form;
          if (form && !form.reportValidity()) {
            return;
          }
          dialogRef.current?.showModal();
        }}
        type="button"
        variant={variant}
      >
        {triggerLabel}
      </Button>
      <dialog
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        className="fixed inset-0 m-auto max-h-[calc(100dvh-32px)] w-[min(480px,calc(100%-32px))] max-w-none rounded-xl border border-[var(--line)] bg-[var(--surface)] p-0 text-[var(--foreground)] shadow-[0_16px_48px_rgba(31,35,40,0.2)] backdrop:bg-[rgba(31,35,40,0.45)] backdrop:backdrop-blur-[1px]"
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            event.currentTarget.close();
          }
        }}
        ref={dialogRef}
      >
        <div className="grid gap-6 p-6">
          <div className="grid gap-2 [&_h2]:m-0 [&_h2]:text-xl [&_p]:m-0 [&_p]:text-[var(--muted)]">
            <h2 id={titleId}>{title}</h2>
            <p id={descriptionId}>{description}</p>
          </div>
          <div className="flex flex-col-reverse items-stretch justify-end gap-2 md:flex-row md:items-center">
            <Button
              disabled={pending}
              onClick={() => dialogRef.current?.close()}
              type="button"
              variant="secondary"
            >
              Cancel
            </Button>
            <Button
              disabled={pending}
              name={name}
              type="submit"
              value={value}
              variant={confirmVariant}
            >
              {pending ? 'Working…' : confirmLabel}
            </Button>
          </div>
        </div>
      </dialog>
    </>
  );
}
