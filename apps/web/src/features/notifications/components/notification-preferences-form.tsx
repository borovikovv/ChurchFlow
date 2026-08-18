'use client';

import type {
  NotificationPreferences,
  UpdateNotificationPreferencesInput,
} from '@churchflow/shared';
import { useTranslations } from 'next-intl';
import type { ChangeEvent, ReactNode } from 'react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'react-toastify';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import {
  createTelegramNotificationLink,
  disconnectTelegramNotifications,
  updateNotificationPreferences,
} from '../server/actions';

export function NotificationPreferencesForm({
  organizationId,
  preferences,
  userEmail,
}: {
  organizationId: string;
  preferences: NotificationPreferences;
  userEmail: string | null;
}) {
  const t = useTranslations('notifications');
  const [savedPreferences, setSavedPreferences] = useState(preferences);
  const [savingPreference, setSavingPreference] =
    useState<NotificationPreferenceCheckboxName | null>(null);
  const [telegramActionPending, setTelegramActionPending] = useState(false);
  const { register, getValues, watch, reset } = useForm<UpdateNotificationPreferencesInput>({
    defaultValues: toFormValues(savedPreferences, userEmail),
  });
  const values = watch();
  const canUseEmail = Boolean(userEmail);
  const canUseTelegram = savedPreferences.telegram.enabled;
  const preferencesPending = savingPreference !== null;

  const savePreferences = async (
    input: UpdateNotificationPreferencesInput,
    preferenceName: NotificationPreferenceCheckboxName,
  ) => {
    if (preferencesPending) return;
    setSavingPreference(preferenceName);

    try {
      const payload = {
        ...input,
        emailEnabled: canUseEmail ? input.emailEnabled : false,
        telegramEnabled: canUseTelegram ? input.telegramEnabled : false,
        timeZone: browserTimeZone(),
      };
      const result = await updateNotificationPreferences(organizationId, payload);

      if (result.ok) {
        const nextPreferences = result.data;
        setSavedPreferences(nextPreferences);
        reset(toFormValues(nextPreferences, userEmail));
        toast.success(t('saved'));
        return;
      }

      reset(toFormValues(savedPreferences, userEmail));
      toast.error(result.error);
    } catch (error: unknown) {
      reset(toFormValues(savedPreferences, userEmail));
      toast.error(error instanceof Error ? error.message : t('saveFailed'));
    } finally {
      setSavingPreference(null);
    }
  };

  const registerPreference = (name: NotificationPreferenceCheckboxName) => {
    const field = register(name);

    return {
      ...field,
      onChange: (event: ChangeEvent<HTMLInputElement>) => {
        field.onChange(event);
        const nextValues = {
          ...getValues(),
          [name]: event.currentTarget.checked,
        };
        void savePreferences(nextValues, name);
      },
    };
  };

  const connectTelegram = async () => {
    if (telegramActionPending) return;
    setTelegramActionPending(true);
    const telegramWindow = window.open('about:blank', '_blank');

    try {
      const result = await createTelegramNotificationLink(organizationId);
      if (!result.ok) {
        telegramWindow?.close();
        toast.error(result.error);
        return;
      }

      if (telegramWindow) {
        telegramWindow.opener = null;
        telegramWindow.location.href = result.data.url;
      } else {
        window.location.assign(result.data.url);
      }
      toast.info(t('finishTelegram'));
    } finally {
      setTelegramActionPending(false);
    }
  };

  const disconnectTelegram = async () => {
    if (telegramActionPending) return;
    setTelegramActionPending(true);

    try {
      const result = await disconnectTelegramNotifications(organizationId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      const nextPreferences = {
        ...savedPreferences,
        telegramEnabled: false,
        telegram: result.data.telegram,
      };
      setSavedPreferences(nextPreferences);
      reset(toFormValues(nextPreferences, userEmail));
      toast.success(t('telegramDisconnected'));
    } finally {
      setTelegramActionPending(false);
    }
  };

  return (
    <form className="stack max-w-2xl" onSubmit={(event) => event.preventDefault()}>
      <section className="stack rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] p-6 shadow-[var(--shadow)]">
        <div className="stack gap-1">
          <h2 className="m-0 text-2xl">{t('deliveryChannels')}</h2>
          <p className="m-0 text-[var(--muted)]">{t('deliveryChannelsDescription')}</p>
        </div>

        <div className="grid gap-4">
          <PreferenceRow
            offLabel={t('off')}
            onLabel={t('on')}
            title={t('inApp')}
            description={t('inAppDescription')}
            checked={values.inAppEnabled}
          >
            <Checkbox
              disabled={preferencesPending}
              label={checkboxStateLabel(values.inAppEnabled, savingPreference === 'inAppEnabled', {
                disabled: t('disabled'),
                enabled: t('enabled'),
                saving: t('saving'),
              })}
              {...registerPreference('inAppEnabled')}
            />
          </PreferenceRow>

          <PreferenceRow
            offLabel={t('off')}
            onLabel={t('on')}
            title={t('email')}
            description={
              canUseEmail
                ? t('emailDescription', { email: userEmail ?? '' })
                : t('emailMissingDescription')
            }
            checked={values.emailEnabled && canUseEmail}
          >
            <Checkbox
              disabled={preferencesPending || !canUseEmail}
              label={checkboxStateLabel(
                values.emailEnabled && canUseEmail,
                savingPreference === 'emailEnabled',
                {
                  disabled: t('disabled'),
                  enabled: t('enabled'),
                  saving: t('saving'),
                },
              )}
              {...registerPreference('emailEnabled')}
            />
          </PreferenceRow>

          <PreferenceRow
            offLabel={t('off')}
            onLabel={t('on')}
            title={t('telegram')}
            description={telegramDescription(savedPreferences.telegram, {
              blocked: t('telegramBlocked'),
              connectFirst: t('telegramConnectFirst'),
              connected: t('telegramConnected'),
              revoked: t('telegramRevoked'),
              username: (username) => t('telegramUsername', { username }),
            })}
            checked={values.telegramEnabled && canUseTelegram}
          >
            <div className="flex flex-wrap items-center gap-2">
              <Checkbox
                disabled={preferencesPending || !canUseTelegram}
                label={checkboxStateLabel(
                  values.telegramEnabled && canUseTelegram,
                  savingPreference === 'telegramEnabled',
                  {
                    disabled: t('disabled'),
                    enabled: t('enabled'),
                    saving: t('saving'),
                  },
                )}
                {...registerPreference('telegramEnabled')}
              />
              {savedPreferences.telegram.enabled ? (
                <Button
                  disabled={telegramActionPending}
                  onClick={disconnectTelegram}
                  type="button"
                  variant="secondary"
                  className="min-h-8 px-2 py-1 text-xs"
                >
                  {telegramActionPending ? t('disconnecting') : t('disconnect')}
                </Button>
              ) : (
                <Button
                  disabled={telegramActionPending}
                  onClick={connectTelegram}
                  type="button"
                  variant="secondary"
                  className="min-h-8 px-2 py-1 text-xs"
                >
                  {telegramActionPending ? t('opening') : t('connectBot')}
                </Button>
              )}
            </div>
          </PreferenceRow>
        </div>
      </section>

      <section className="stack rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] p-6 shadow-[var(--shadow)]">
        <div className="stack gap-1">
          <h2 className="m-0 text-2xl">{t('typesTitle')}</h2>
          <p className="m-0 text-[var(--muted)]">{t('typesDescription')}</p>
        </div>

        <div className="grid gap-3">
          <PreferenceRow
            offLabel={t('off')}
            onLabel={t('on')}
            title={t('taskAssignments')}
            description={t('taskAssignmentsDescription')}
            checked={values.taskAssignedEnabled}
          >
            <Checkbox
              disabled={preferencesPending}
              label={checkboxStateLabel(
                values.taskAssignedEnabled,
                savingPreference === 'taskAssignedEnabled',
                {
                  disabled: t('disabled'),
                  enabled: t('enabled'),
                  saving: t('saving'),
                },
              )}
              {...registerPreference('taskAssignedEnabled')}
            />
          </PreferenceRow>
          <PreferenceRow
            offLabel={t('off')}
            onLabel={t('on')}
            title={t('serviceAssignments')}
            description={t('serviceAssignmentsDescription')}
            checked={values.serviceAssignedEnabled}
          >
            <Checkbox
              disabled={preferencesPending}
              label={checkboxStateLabel(
                values.serviceAssignedEnabled,
                savingPreference === 'serviceAssignedEnabled',
                {
                  disabled: t('disabled'),
                  enabled: t('enabled'),
                  saving: t('saving'),
                },
              )}
              {...registerPreference('serviceAssignedEnabled')}
            />
          </PreferenceRow>
          <PreferenceRow
            offLabel={t('off')}
            onLabel={t('on')}
            title={t('reminders')}
            description={t('remindersDescription')}
            checked={values.remindersEnabled}
          >
            <Checkbox
              disabled={preferencesPending}
              label={checkboxStateLabel(
                values.remindersEnabled,
                savingPreference === 'remindersEnabled',
                {
                  disabled: t('disabled'),
                  enabled: t('enabled'),
                  saving: t('saving'),
                },
              )}
              {...registerPreference('remindersEnabled')}
            />
          </PreferenceRow>
          <PreferenceRow
            offLabel={t('off')}
            onLabel={t('on')}
            title={t('birthdayDigest')}
            description={t('birthdayDigestDescription')}
            checked={values.birthdayDigestEnabled}
          >
            <Checkbox
              disabled={preferencesPending}
              label={checkboxStateLabel(
                values.birthdayDigestEnabled,
                savingPreference === 'birthdayDigestEnabled',
                {
                  disabled: t('disabled'),
                  enabled: t('enabled'),
                  saving: t('saving'),
                },
              )}
              {...registerPreference('birthdayDigestEnabled')}
            />
          </PreferenceRow>
          <PreferenceRow
            offLabel={t('off')}
            onLabel={t('on')}
            title={t('organizationUpdates')}
            description={t('organizationUpdatesDescription')}
            checked={values.organizationUpdatesEnabled}
          >
            <Checkbox
              disabled={preferencesPending}
              label={checkboxStateLabel(
                values.organizationUpdatesEnabled,
                savingPreference === 'organizationUpdatesEnabled',
                {
                  disabled: t('disabled'),
                  enabled: t('enabled'),
                  saving: t('saving'),
                },
              )}
              {...registerPreference('organizationUpdatesEnabled')}
            />
          </PreferenceRow>
        </div>
      </section>
    </form>
  );
}

type NotificationPreferenceCheckboxName = Exclude<
  keyof UpdateNotificationPreferencesInput,
  'timeZone'
>;

function PreferenceRow({
  title,
  description,
  checked,
  offLabel,
  onLabel,
  children,
}: {
  title: string;
  description: string;
  checked: boolean;
  offLabel: string;
  onLabel: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-3 rounded-[var(--radius)] border border-[var(--line)] p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="stack gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="m-0 text-base">{title}</h3>
          <span className={`status-badge status-${checked ? 'on' : 'off'}`}>
            {checked ? onLabel : offLabel}
          </span>
        </div>
        <p className="m-0 text-sm text-[var(--muted)]">{description}</p>
      </div>
      {children}
    </div>
  );
}

function checkboxStateLabel(
  checked: boolean,
  saving: boolean,
  labels: { disabled: string; enabled: string; saving: string },
): string {
  if (saving) return labels.saving;
  return checked ? labels.enabled : labels.disabled;
}

function telegramDescription(
  preferences: NotificationPreferences['telegram'],
  labels: {
    blocked: string;
    connected: string;
    connectFirst: string;
    revoked: string;
    username: (username: string) => string;
  },
): string {
  if (preferences.blockedAt) return labels.blocked;
  if (preferences.revokedAt) return labels.revoked;
  if (preferences.enabled) {
    return preferences.username ? labels.username(preferences.username) : labels.connected;
  }

  return labels.connectFirst;
}

function toFormValues(
  preferences: NotificationPreferences,
  userEmail: string | null,
): UpdateNotificationPreferencesInput {
  return {
    inAppEnabled: preferences.inAppEnabled,
    emailEnabled: Boolean(userEmail) && preferences.emailEnabled,
    telegramEnabled: preferences.telegram.enabled && preferences.telegramEnabled,
    taskAssignedEnabled: preferences.taskAssignedEnabled,
    serviceAssignedEnabled: preferences.serviceAssignedEnabled,
    remindersEnabled: preferences.remindersEnabled,
    birthdayDigestEnabled: preferences.birthdayDigestEnabled,
    organizationUpdatesEnabled: preferences.organizationUpdatesEnabled,
    timeZone: preferences.timeZone ?? browserTimeZone(),
  };
}

function browserTimeZone(): string | null {
  if (typeof Intl === 'undefined') return null;
  return Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
}
