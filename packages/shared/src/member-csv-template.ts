import { MEMBER_CSV_TEMPLATE_COLUMNS } from './constants.js';

/**
 * The example row leaves `groups` empty on purpose: group names are per-organization data, so any
 * name hardcoded here would fail the import for every organization that does not happen to use it.
 */
const MEMBER_CSV_TEMPLATE_EXAMPLE_ROW = {
  displayName: 'Jane Doe',
  email: 'jane@example.com',
  phone: '+380501112233',
  role: 'MEMBER',
  groups: '',
  memberSince: '2024-01-14',
  birthday: '1991-05-20',
  anniversary: '',
  notes: 'Small group leader',
  biography: '',
  familyNotes: '',
} as const satisfies Record<(typeof MEMBER_CSV_TEMPLATE_COLUMNS)[number], string>;

export function createMembersCsvTemplate(): string {
  return [
    MEMBER_CSV_TEMPLATE_COLUMNS.join(','),
    MEMBER_CSV_TEMPLATE_COLUMNS.map((column) =>
      escapeCsvValue(MEMBER_CSV_TEMPLATE_EXAMPLE_ROW[column]),
    ).join(','),
  ].join('\n');
}

function escapeCsvValue(value: string): string {
  if (!/[",\n\r]/.test(value)) return value;
  return `"${value.replaceAll('"', '""')}"`;
}
