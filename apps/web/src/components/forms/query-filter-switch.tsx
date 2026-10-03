'use client';

import type { Route } from 'next';
import { usePathname, useRouter } from 'next/navigation';
import { Checkbox } from '@/components/ui/checkbox';
import { queryHref } from '@/lib/query-href';

export function QueryFilterSwitch({
  checked,
  label,
  name,
  preserveParams,
}: {
  checked: boolean;
  label: string;
  name: string;
  preserveParams: Record<string, string | undefined>;
}) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <Checkbox
      appearance="switch"
      checked={checked}
      label={label}
      onChange={(event) => {
        router.push(
          queryHref(
            pathname,
            preserveParams,
            name,
            event.currentTarget.checked ? 'true' : '',
          ) as Route,
        );
      }}
    />
  );
}
