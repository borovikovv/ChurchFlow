'use client';

import { useState, type ReactNode } from 'react';
import type { BoardDropTarget } from './board.types';
import { boardDropZoneVariants } from './board-node.styles';
import { useGroupsBoardContext } from './groups-board-context';

export function BoardDropZone({
  target,
  label,
  hint,
  children,
}: {
  target: BoardDropTarget;
  label: string;
  hint: string;
  children: ReactNode;
}) {
  const { canManage, isDragging, dropOn } = useGroupsBoardContext();
  const [isOver, setIsOver] = useState(false);
  const accepts = canManage && isDragging;

  return (
    <section
      aria-label={label}
      className={boardDropZoneVariants({ state: !accepts ? 'idle' : isOver ? 'over' : 'ready' })}
      onDragEnter={(event) => {
        if (!accepts) return;
        event.preventDefault();
        setIsOver(true);
      }}
      onDragLeave={(event) => {
        const next = event.relatedTarget;
        if (next instanceof Node && event.currentTarget.contains(next)) return;
        setIsOver(false);
      }}
      onDragOver={(event) => {
        if (!accepts) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = event.altKey ? 'copy' : 'move';
      }}
      onDrop={(event) => {
        if (!accepts) return;
        event.preventDefault();
        setIsOver(false);
        dropOn(target, event.altKey);
      }}
    >
      <h4 className="m-0 px-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
        {label}
      </h4>
      {children}
      {accepts ? <p className="m-0 px-1.5 text-xs text-[var(--muted)]">{hint}</p> : null}
    </section>
  );
}
