'use client';

import { useId, useRef, type ReactNode, type RefObject } from 'react';
import { Button, type ButtonVariant } from '@/components/ui/button';

export function FormDialog({
  footer,
  triggerLabel,
  triggerVariant = 'secondary',
  triggerClassName,
  triggerDisabled = false,
  title,
  children,
  dialogRef: externalDialogRef,
  onOpen,
  onClose,
}: {
  footer?: ReactNode;
  triggerLabel: ReactNode;
  triggerVariant?: ButtonVariant;
  triggerClassName?: string;
  triggerDisabled?: boolean;
  title: string;
  children: ReactNode;
  dialogRef?: RefObject<HTMLDialogElement | null>;
  onOpen?: () => void;
  onClose?: () => void;
}) {
  const internalDialogRef = useRef<HTMLDialogElement>(null);
  const dialogRef = externalDialogRef ?? internalDialogRef;
  const titleId = useId();

  return (
    <>
      <Button
        className={triggerClassName}
        disabled={triggerDisabled}
        type="button"
        variant={triggerVariant}
        onClick={() => {
          onOpen?.();
          dialogRef.current?.showModal();
        }}
      >
        {triggerLabel}
      </Button>
      <dialog
        aria-labelledby={titleId}
        className="fixed inset-0 m-auto max-h-[min(800px,80dvh)] w-[min(480px,calc(100%-32px))] max-w-none rounded-xl border border-[var(--line)] bg-[var(--surface)] p-0 text-[var(--foreground)] shadow-[0_16px_48px_rgba(31,35,40,0.2)] backdrop:bg-[rgba(31,35,40,0.45)] backdrop:backdrop-blur-[1px]"
        onClose={onClose}
        onClick={(event) => {
          if (event.target === event.currentTarget) event.currentTarget.close();
        }}
        ref={dialogRef}
      >
        <div className="grid max-h-[min(800px,80dvh)] grid-rows-[auto_minmax(0,1fr)_auto]">
          <header className="flex items-center justify-between border-b border-[var(--line)] p-5">
            <h2 id={titleId}>{title}</h2>
            <button
              aria-label="Close"
              className="h-8 w-8 cursor-pointer rounded-[var(--radius)] border-0 bg-transparent text-2xl text-[var(--muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]"
              type="button"
              onClick={() => dialogRef.current?.close()}
            >
              ×
            </button>
          </header>
          <div className="min-h-0 overflow-y-auto p-5">{children}</div>
          <footer className="flex justify-end border-t border-[var(--line)] p-5">
            {footer ?? (
              <Button type="button" variant="secondary" onClick={() => dialogRef.current?.close()}>
                Cancel
              </Button>
            )}
          </footer>
        </div>
      </dialog>
    </>
  );
}
