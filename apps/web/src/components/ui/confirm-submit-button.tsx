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
}: {
  triggerLabel: string;
  title: string;
  description: string;
  confirmLabel: string;
  variant?: ButtonVariant;
  confirmVariant?: ButtonVariant;
  name?: string;
  value?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const { pending } = useFormStatus();

  return (
    <>
      <Button
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
        className="confirmation-dialog"
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            event.currentTarget.close();
          }
        }}
        ref={dialogRef}
      >
        <div className="confirmation-dialog-content">
          <div className="confirmation-dialog-copy">
            <h2 id={titleId}>{title}</h2>
            <p id={descriptionId}>{description}</p>
          </div>
          <div className="confirmation-dialog-actions">
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
