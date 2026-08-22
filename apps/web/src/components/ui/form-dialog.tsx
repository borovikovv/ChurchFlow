'use client';

import { useTranslations } from 'next-intl';
import { useId, useRef, type ReactNode, type RefObject } from 'react';
import { Button, type ButtonVariant } from '@/components/ui/button';
import { formDialogClassName, formDialogLayoutClassName } from './form-dialog.styles';

export type FormDialogSize = 'sm' | 'md' | 'lg';

export function FormDialog({
  bodyClassName,
  footer,
  fullScreenOnMobile = false,
  size = 'sm',
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
  bodyClassName?: string;
  footer?: ReactNode;
  fullScreenOnMobile?: boolean;
  size?: FormDialogSize;
  /** Omit to render no trigger; the dialog is then opened through `dialogRef`. */
  triggerLabel?: ReactNode;
  triggerVariant?: ButtonVariant;
  triggerClassName?: string;
  triggerDisabled?: boolean;
  title: ReactNode;
  children: ReactNode;
  dialogRef?: RefObject<HTMLDialogElement | null>;
  onOpen?: () => void;
  onClose?: () => void;
}) {
  const t = useTranslations('common');
  const internalDialogRef = useRef<HTMLDialogElement>(null);
  const dialogRef = externalDialogRef ?? internalDialogRef;
  const titleId = useId();

  return (
    <>
      {triggerLabel !== undefined ? (
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
      ) : null}
      <dialog
        aria-labelledby={titleId}
        className={formDialogClassName({ fullScreenOnMobile, size })}
        onClose={onClose}
        onClick={(event) => {
          if (event.target === event.currentTarget) event.currentTarget.close();
        }}
        ref={dialogRef}
      >
        <div className={formDialogLayoutClassName({ fullScreenOnMobile })}>
          <header className="flex items-center justify-between border-b border-[var(--line)] p-5">
            <h2 id={titleId}>{title}</h2>
            <button
              aria-label={t('close')}
              className="h-8 w-8 cursor-pointer rounded-[var(--radius)] border-0 bg-transparent text-2xl text-[var(--muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]"
              type="button"
              onClick={() => dialogRef.current?.close()}
            >
              ×
            </button>
          </header>
          <div
            className={
              bodyClassName
                ? `min-h-0 overflow-y-auto ${bodyClassName}`
                : 'min-h-0 overflow-y-auto p-5'
            }
          >
            {children}
          </div>
          <footer className="flex flex-col-reverse items-stretch gap-2 border-t border-[var(--line)] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:flex-row sm:items-center sm:justify-end sm:pb-5">
            {footer ?? (
              <Button type="button" variant="secondary" onClick={() => dialogRef.current?.close()}>
                {t('cancel')}
              </Button>
            )}
          </footer>
        </div>
      </dialog>
    </>
  );
}
