const SKELETON_ROW_WIDTHS = ['w-3/4', 'w-1/2', 'w-2/3'];

export function CalendarEventsSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <ul aria-hidden="true" className="m-0 grid list-none gap-2 p-0">
      {Array.from({ length: rows }, (_, index) => (
        <li className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-2" key={index}>
          <span className="mt-2 h-3 w-10 animate-pulse rounded bg-[var(--line-muted)]" />
          <span className="grid min-h-11 content-center gap-1.5 rounded-md border-l-4 border-[var(--line)] bg-[var(--surface-subtle)] px-2.5 py-2">
            <span
              className={`h-3 animate-pulse rounded bg-[var(--line-muted)] ${SKELETON_ROW_WIDTHS[index % SKELETON_ROW_WIDTHS.length]}`}
            />
            <span className="h-2.5 w-16 animate-pulse rounded bg-[var(--line-muted)]" />
          </span>
        </li>
      ))}
    </ul>
  );
}
