'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import {
  CALENDAR_SERVICE_ROLE_FALLBACK_GROUP_ICONS,
  CALENDAR_SERVICE_ROLES,
  emptyServiceRoleGroups,
  type OrganizationGroupListItem,
  type ServiceRoleGroups,
} from '@churchflow/shared';
import { FormMultiSelect } from '@/components/forms/form-multi-select';
import { Button } from '@/components/ui/button';
import { FormDialog } from '@/components/ui/form-dialog';
import { serviceRoleLabel } from '@/features/groups/lib/service-role-labels';
import { loadServiceRoleGroupsAction, saveServiceRoleGroupsAction } from '../actions';

/**
 * Picks, for every service role, the groups whose members the service form suggests first.
 * The trigger shows how many roles still have no group.
 */
export function ServiceRolesDialog({
  groups,
  organizationId,
  onSaved,
}: {
  groups: OrganizationGroupListItem[];
  organizationId: string;
  onSaved: (roles: ServiceRoleGroups) => void;
}) {
  const t = useTranslations('groups');
  const commonT = useTranslations('common');
  const locale = useLocale();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [roles, setRoles] = useState<ServiceRoleGroups>(emptyServiceRoleGroups);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const unlinkedCount = CALENDAR_SERVICE_ROLES.filter(
    (role) => !groups.some((group) => group.serviceRoles.includes(role)),
  ).length;
  const groupOptions = groups.map((group) => ({ label: group.name, value: group.id }));

  const open = async () => {
    setError(null);
    setLoading(true);
    const result = await loadServiceRoleGroupsAction({ organizationId });
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setRoles(result.payload.roles);
  };

  const save = async () => {
    setSaving(true);
    const result = await saveServiceRoleGroupsAction({ organizationId, roles });
    setSaving(false);
    if (!result.ok) {
      setError(result.error || t('serviceRolesSaveError'));
      return;
    }

    onSaved(result.payload.roles);
    dialogRef.current?.close();
  };

  return (
    <FormDialog
      dialogRef={dialogRef}
      fullScreenOnMobile
      size="md"
      title={t('serviceRoles')}
      triggerLabel={
        <span className="inline-flex items-center gap-2">
          {t('serviceRoles')}
          {unlinkedCount > 0 ? (
            <span className="rounded-full border border-[rgba(154,103,0,0.25)] bg-[var(--warning-subtle)] px-1.5 text-xs font-semibold text-[var(--warning)]">
              {t('serviceRolesUnlinked', { count: unlinkedCount })}
            </span>
          ) : null}
        </span>
      }
      onOpen={() => void open()}
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => dialogRef.current?.close()}>
            {t('cancel')}
          </Button>
          <Button disabled={loading || saving} type="button" onClick={() => void save()}>
            {commonT('save')}
          </Button>
        </div>
      }
    >
      <div className="stack">
        <p className="m-0 text-sm text-[var(--muted)]">{t('serviceRolesDescription')}</p>
        {error ? <p className="form-error">{error}</p> : null}
        {CALENDAR_SERVICE_ROLES.map((role) => (
          <div className="grid gap-1" key={role}>
            <FormMultiSelect
              label={serviceRoleLabel(locale, role)}
              noOptionsMessage={t('serviceRoleNoGroups')}
              options={groupOptions}
              placeholder={t('serviceRoleAddGroup')}
              value={roles[role]}
              onChange={(groupIds) => setRoles((current) => ({ ...current, [role]: groupIds }))}
            />
            {!loading && roles[role].length === 0 ? (
              <small className="rounded-[var(--radius)] border border-[rgba(154,103,0,0.25)] bg-[var(--warning-subtle)] px-2 py-1 text-[var(--warning)]">
                {fallbackHint(role)}
              </small>
            ) : null}
          </div>
        ))}
      </div>
    </FormDialog>
  );

  function fallbackHint(role: (typeof CALENDAR_SERVICE_ROLES)[number]) {
    const icons = CALENDAR_SERVICE_ROLE_FALLBACK_GROUP_ICONS[role].map((icon) =>
      t(`icons.${icon}`),
    );

    return icons.length > 0
      ? t('serviceRoleFallback', { icons: icons.join(', ') })
      : t('serviceRoleFallbackNone');
  }
}
