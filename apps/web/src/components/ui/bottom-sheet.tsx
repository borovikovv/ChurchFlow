'use client';

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import styles from './bottom-sheet.module.css';
import {
  BOTTOM_SHEET_CLASS_NAME,
  BOTTOM_SHEET_GRABBER_CLASS_NAME,
  BOTTOM_SHEET_HANDLE_CLASS_NAME,
  BOTTOM_SHEET_LAYOUT_CLASS_NAME,
} from './bottom-sheet.styles';

const INTERACTIVE_SELECTOR =
  'a, button, input, select, textarea, label, [role="button"], [role="option"], [role="listbox"]';
const DRAG_START_THRESHOLD = 8;
const DRAG_CLOSE_DISTANCE = 96;
const DRAG_CLOSE_VELOCITY = 0.5;
const DRAG_CLOSE_DURATION = 200;

interface SheetDrag {
  pointerId: number;
  startY: number;
  startTime: number;
  active: boolean;
}

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
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<SheetDrag | null>(null);
  const closeTimeoutRef = useRef<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dragRef.current = null;
      setDragging(false);
      setDragOffset(0);
      dialog.showModal();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(
    () => () => {
      if (closeTimeoutRef.current !== null) window.clearTimeout(closeTimeoutRef.current);
    },
    [],
  );

  const closeWithSlideOut = useCallback(() => {
    const dialog = dialogRef.current;
    if (!dialog || closeTimeoutRef.current !== null) return;

    setDragOffset(dialog.getBoundingClientRect().height);
    closeTimeoutRef.current = window.setTimeout(() => {
      closeTimeoutRef.current = null;
      dialog.close();
    }, DRAG_CLOSE_DURATION);
  }, []);

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    // Dragging captures the pointer, which cancels the click on whatever it started on.
    if ((event.target as Element | null)?.closest(INTERACTIVE_SELECTOR)) return;

    const scroller = scrollRef.current;
    const startsInScrollableContent =
      scroller !== null &&
      scroller.contains(event.target as Node) &&
      scroller.scrollHeight > scroller.clientHeight;

    if (startsInScrollableContent) return;

    dragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startTime: event.timeStamp,
      active: false,
    };
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const delta = event.clientY - drag.startY;

    if (!drag.active) {
      if (delta < DRAG_START_THRESHOLD) return;
      drag.active = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      setDragging(true);
    }

    setDragOffset(Math.max(0, delta));
  }

  function handlePointerCancel(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    dragRef.current = null;
    setDragging(false);
    setDragOffset(0);
  }

  function handlePointerEnd(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (!drag.active) return;

    setDragging(false);

    const delta = Math.max(0, event.clientY - drag.startY);
    const velocity = delta / Math.max(1, event.timeStamp - drag.startTime);
    const shouldClose =
      delta > DRAG_CLOSE_DISTANCE ||
      (velocity > DRAG_CLOSE_VELOCITY && delta > DRAG_START_THRESHOLD);

    if (shouldClose) {
      closeWithSlideOut();
      return;
    }

    setDragOffset(0);
  }

  return (
    <dialog
      aria-labelledby={titleId}
      className={`${BOTTOM_SHEET_CLASS_NAME} ${styles['sheet']} ${dragging ? '' : 'transition-transform duration-200 ease-out'}`}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) closeWithSlideOut();
      }}
      ref={dialogRef}
      style={dragOffset > 0 ? { transform: `translateY(${dragOffset}px)` } : undefined}
    >
      <div
        className={BOTTOM_SHEET_LAYOUT_CLASS_NAME}
        onPointerCancel={handlePointerCancel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
      >
        <div className={BOTTOM_SHEET_HANDLE_CLASS_NAME}>
          <span aria-hidden="true" className={BOTTOM_SHEET_GRABBER_CLASS_NAME} />
          <header className="px-5 pt-4 pb-2">
            <h2 className="text-2xl" id={titleId}>
              {title}
            </h2>
          </header>
        </div>
        <div className="min-h-0 overflow-y-auto" ref={scrollRef}>
          {children}
        </div>
      </div>
    </dialog>
  );
}
