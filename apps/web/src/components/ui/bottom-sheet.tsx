'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import styles from './bottom-sheet.module.css';
import {
  BOTTOM_SHEET_CLASS_NAME,
  BOTTOM_SHEET_GRABBER_CLASS_NAME,
  BOTTOM_SHEET_LAYOUT_CLASS_NAME,
} from './bottom-sheet.styles';

export function BottomSheet({
  children,
  open,
  title,
  onClose,
}: {
  children: ReactNode;
  open: boolean;
  title: ReactNode;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      aria-labelledby={titleId}
      className={`${BOTTOM_SHEET_CLASS_NAME} ${styles['sheet']}`}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}
      ref={dialogRef}
    >
      <div className={BOTTOM_SHEET_LAYOUT_CLASS_NAME}>
        <span aria-hidden="true" className={BOTTOM_SHEET_GRABBER_CLASS_NAME} />
        <header className="px-5 pt-4 pb-2">
          <h2 className="text-2xl" id={titleId}>
            {title}
          </h2>
        </header>
        <div className="min-h-0 overflow-y-auto">{children}</div>
      </div>
    </dialog>
  );
}
