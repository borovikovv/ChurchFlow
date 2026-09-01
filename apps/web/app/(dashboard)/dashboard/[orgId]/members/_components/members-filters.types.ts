import type { SelectOption } from '@/components/forms/form-select';

export interface MembersFilterParams {
  access?: string | undefined;
  groups?: string | undefined;
  pageSize?: string | undefined;
  search?: string | undefined;
  tab?: string | undefined;
  type?: string | undefined;
}

export interface MembersFiltersProps {
  accessOptions: SelectOption[];
  accessValue: string;
  groupOptions: SelectOption[];
  groupValue: string[];
  preserved: MembersFilterParams;
  showAccessFilter: boolean;
  typeOptions: SelectOption[];
  typeValue: string;
  variant: 'inline' | 'sheet';
}
