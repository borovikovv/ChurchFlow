'use client';

import { useId, useRef, type ReactNode } from 'react';
import { Button, type ButtonVariant } from '@/components/ui/button';

export function FormDialog({
  triggerLabel,
  triggerVariant = 'secondary',
  triggerClassName,
  title,
  children,
}: {
  triggerLabel: string;
  triggerVariant?: ButtonVariant;
  triggerClassName?: string;
  title: string;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  return (
    <>
      <Button
        className={triggerClassName}
        type="button"
        variant={triggerVariant}
        onClick={() => dialogRef.current?.showModal()}
      >
        {triggerLabel}
      </Button>
      <dialog
        aria-labelledby={titleId}
        className="fixed inset-0 m-auto max-h-[calc(100dvh-32px)] w-[min(480px,calc(100%-32px))] max-w-none rounded-xl border border-[var(--line)] bg-[var(--surface)] p-0 text-[var(--foreground)] shadow-[0_16px_48px_rgba(31,35,40,0.2)] backdrop:bg-[rgba(31,35,40,0.45)] backdrop:backdrop-blur-[1px]"
        onClick={(event) => {
          if (event.target === event.currentTarget) event.currentTarget.close();
        }}
        ref={dialogRef}
      >
        <div className="grid gap-6 p-6">
          <h2 id={titleId}>{title}</h2>
          {children}
          <Button type="button" variant="secondary" onClick={() => dialogRef.current?.close()}>
            Cancel
          </Button>
        </div>
      </dialog>
    </>
  );
}
