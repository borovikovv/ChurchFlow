import type { ReactNode } from 'react';

export function ProfileCard({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="stack w-full rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] p-6 shadow-[var(--shadow)]">
      <div className="flex flex-col items-start justify-between gap-3 md:flex-row md:items-center">
        <div className="stack gap-1">
          <h2 className="m-0 text-2xl">{title}</h2>
          {description ? <p className="m-0 text-[var(--muted)]">{description}</p> : null}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}
