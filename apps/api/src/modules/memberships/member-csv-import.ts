import {
  createManualOrganizationMemberSchema,
  MEMBER_CSV_TEMPLATE_COLUMNS,
} from '@churchflow/shared';
import type { CreateManualOrganizationMemberInput } from '@churchflow/shared';

type CsvColumn = (typeof MEMBER_CSV_TEMPLATE_COLUMNS)[number];

export interface MemberCsvImportError {
  row: number;
  field: CsvColumn | null;
  message: string;
}

export interface ParsedMemberCsvImport {
  rows: CreateManualOrganizationMemberInput[];
  errors: MemberCsvImportError[];
  totalRows: number;
}

const COLUMN_SET = new Set<string>(MEMBER_CSV_TEMPLATE_COLUMNS);
const REQUIRED_COLUMNS = ['displayName'] as const satisfies readonly CsvColumn[];

export function parseMembersCsv(
  csv: string,
  organizationGroups: ReadonlyArray<{ id: string; name: string }> = [],
): ParsedMemberCsvImport {
  const groupIdsByName = new Map(
    organizationGroups.map((group) => [group.name.trim().toLowerCase(), group.id]),
  );
  const records = parseCsvRecords(csv.replace(/^\uFEFF/, ''));
  if (records.length === 0) {
    return {
      rows: [],
      errors: [{ row: 1, field: null, message: 'CSV file is empty.' }],
      totalRows: 0,
    };
  }

  const headerRecord = records[0];
  if (!headerRecord) {
    return {
      rows: [],
      errors: [{ row: 1, field: null, message: 'CSV file is empty.' }],
      totalRows: 0,
    };
  }

  const headers = headerRecord.map((header) => header.trim());
  const errors: MemberCsvImportError[] = [];
  const unknownHeader = headers.find((header) => header && !COLUMN_SET.has(header));
  if (unknownHeader) {
    errors.push({ row: 1, field: null, message: `Unknown column "${unknownHeader}".` });
  }

  for (const column of REQUIRED_COLUMNS) {
    if (!headers.includes(column)) {
      errors.push({ row: 1, field: column, message: `Missing required column "${column}".` });
    }
  }

  const duplicateHeader = headers.find(
    (header, index) => header && headers.indexOf(header) !== index,
  );
  if (duplicateHeader) {
    errors.push({ row: 1, field: null, message: `Duplicate column "${duplicateHeader}".` });
  }

  if (errors.length > 0) {
    return { rows: [], errors, totalRows: Math.max(records.length - 1, 0) };
  }

  const rows: CreateManualOrganizationMemberInput[] = [];
  const dataRecords = records
    .slice(1)
    .map((record, index) => ({ record, rowNumber: index + 2 }))
    .filter(({ record }) => record.some((value) => value.trim() !== ''));

  dataRecords.forEach(({ record, rowNumber }) => {
    const raw = Object.fromEntries(
      headers.map((header, headerIndex) => [header, record[headerIndex]?.trim() ?? '']),
    ) as Partial<Record<CsvColumn, string>>;

    const groups = resolveGroupIds(csvValue(raw, 'groups'), groupIdsByName);
    if (groups.unknownNames.length > 0) {
      for (const name of groups.unknownNames) {
        errors.push({ row: rowNumber, field: 'groups', message: `Unknown group "${name}".` });
      }
      return;
    }

    const parsed = createManualOrganizationMemberSchema.safeParse({
      displayName: csvValue(raw, 'displayName'),
      email: nullableCsvValue(csvValue(raw, 'email')),
      phone: nullableCsvValue(csvValue(raw, 'phone')),
      notes: nullableCsvValue(csvValue(raw, 'notes')),
      memberSince: nullableCsvValue(csvValue(raw, 'memberSince')),
      birthday: nullableCsvValue(csvValue(raw, 'birthday')),
      anniversary: nullableCsvValue(csvValue(raw, 'anniversary')),
      biography: nullableCsvValue(csvValue(raw, 'biography')),
      familyNotes: nullableCsvValue(csvValue(raw, 'familyNotes')),
      role: csvValue(raw, 'role') || 'MEMBER',
      groups: groups.ids,
    });

    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        errors.push({
          row: rowNumber,
          field: issue.path[0] ? (String(issue.path[0]) as CsvColumn) : null,
          message: issue.message,
        });
      }
      return;
    }

    rows.push(parsed.data);
  });

  return { rows, errors, totalRows: dataRecords.length };
}

function nullableCsvValue(value: string): string | null {
  return value === '' ? null : value;
}

function csvValue(row: Partial<Record<CsvColumn, string>>, column: CsvColumn): string {
  return row[column] ?? '';
}

function resolveGroupIds(
  value: string,
  groupIdsByName: ReadonlyMap<string, string>,
): { ids: string[] | undefined; unknownNames: string[] } {
  if (!value.trim()) return { ids: undefined, unknownNames: [] };

  const names = value
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean);
  const ids: string[] = [];
  const unknownNames: string[] = [];

  for (const name of names) {
    const id = groupIdsByName.get(name.toLowerCase());
    if (id === undefined) {
      unknownNames.push(name);
      continue;
    }
    if (!ids.includes(id)) ids.push(id);
  }

  return { ids, unknownNames };
}

function parseCsvRecords(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let quoted = false;

  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    const nextChar = csv[index + 1];
    if (char === undefined) continue;

    if (char === '"') {
      if (quoted && nextChar === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (char === ',' && !quoted) {
      row.push(value);
      value = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && nextChar === '\n') index += 1;
      row.push(value);
      rows.push(row);
      row = [];
      value = '';
      continue;
    }

    value += char;
  }

  if (value !== '' || row.length > 0) {
    row.push(value);
    rows.push(row);
  }

  return rows.filter((record) => record.some((field) => field.trim() !== ''));
}
