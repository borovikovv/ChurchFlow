import type { CalendarServiceRole } from '@churchflow/shared';
import { serviceRoleLabel } from '../lib/service-role-labels';

/** The service roles a group is linked to, as small tags; renders nothing when there are none. */
export function ServiceRoleTags({
  locale,
  roles,
}: {
  locale: string;
  roles: readonly CalendarServiceRole[];
}) {
  if (roles.length === 0) return null;

  return (
    <ul className="m-0 flex list-none flex-wrap gap-1 p-0">
      {roles.map((role) => (
        <li
          className="rounded-full border border-[#b6e3ff] bg-[var(--accent-subtle)] px-2 text-xs font-medium text-[var(--accent-strong)]"
          key={role}
        >
          {serviceRoleLabel(locale, role)}
        </li>
      ))}
    </ul>
  );
}
