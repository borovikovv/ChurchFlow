'use client';

import {
  FloatingPortal,
  autoUpdate,
  flip,
  offset,
  shift,
  useDismiss,
  useFloating,
  useInteractions,
  useRole,
} from '@floating-ui/react';
import { useState } from 'react';
import { NumericFormat } from 'react-number-format';
import { Button } from '@/components/ui/button';
import { noteButtonClassName, noteIconClassName } from './budget-cell.styles';

export function BudgetCell({
  note,
  onAmountBlur,
  onNoteSave,
  value,
}: {
  note: string | null;
  onAmountBlur: (value: string) => void;
  onNoteSave: (note: string | null) => void;
  value: number;
}) {
  const [open, setOpen] = useState(false);
  const [draftNote, setDraftNote] = useState(note ?? '');
  const hasNote = Boolean(note);
  const { context, floatingStyles, refs } = useFloating({
    middleware: [offset(6), flip({ padding: 12 }), shift({ padding: 12 })],
    onOpenChange: setOpen,
    open,
    placement: 'bottom-end',
    whileElementsMounted: autoUpdate,
  });
  const dismiss = useDismiss(context);
  const role = useRole(context, { role: 'dialog' });
  const { getFloatingProps, getReferenceProps } = useInteractions([dismiss, role]);

  function openEditor() {
    setDraftNote(note ?? '');
    setOpen(true);
  }

  function saveNote() {
    const nextNote = draftNote.trim();
    onNoteSave(nextNote === '' ? null : nextNote);
    setOpen(false);
  }

  function clearNote() {
    setDraftNote('');
    onNoteSave(null);
    setOpen(false);
  }

  return (
    <div className="group/cell relative" title={note ?? undefined}>
      <NumericFormat
        aria-label="Amount"
        allowNegative={false}
        className="h-7 min-h-0 w-full rounded-none border-0 px-2 py-1 pr-7 text-right text-sm tabular-nums shadow-none focus:ring-0"
        decimalScale={2}
        inputMode="decimal"
        thousandSeparator={false}
        {...(value === 0 ? {} : { defaultValue: value })}
        onBlur={(event) => onAmountBlur(event.currentTarget.value)}
      />
      <button
        ref={refs.setReference}
        aria-label={hasNote ? 'Edit cell note' : 'Add cell note'}
        className={noteButtonClassName({ hasNote })}
        {...getReferenceProps({
          type: 'button',
          onClick: openEditor,
        })}
      >
        <span
          aria-hidden="true"
          className={noteIconClassName({ hasNote })}
          style={{
            WebkitMask: "url('/icons/pencil.svg') center / contain no-repeat",
            mask: "url('/icons/pencil.svg') center / contain no-repeat",
          }}
        />
      </button>
      <FloatingPortal>
        {open ? (
          <div
            ref={refs.setFloating}
            style={floatingStyles}
            {...getFloatingProps({
              className:
                'z-50 grid max-h-[min(320px,calc(100vh-32px))] w-[min(280px,calc(100vw-48px))] gap-3 overflow-auto rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3 text-left shadow-[0_12px_36px_rgba(31,35,40,0.18)]',
            })}
          >
            <label className="grid gap-1 text-xs font-medium text-[var(--muted)]">
              Cell note
              <textarea
                className="min-h-24 resize-y rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--foreground)]"
                maxLength={500}
                value={draftNote}
                onChange={(event) => setDraftNote(event.currentTarget.value)}
              />
            </label>
            <div className="flex flex-wrap justify-end gap-2">
              {hasNote ? (
                <Button type="button" variant="ghost" onClick={clearNote}>
                  Clear
                </Button>
              ) : null}
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={saveNote}>
                Save
              </Button>
            </div>
          </div>
        ) : null}
      </FloatingPortal>
    </div>
  );
}
