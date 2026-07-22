'use client';

import {
  updateNotificationPreferencesSchema,
  type NotificationPreferences,
  type UpdateNotificationPreferencesInput,
} from '@churchflow/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
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
  const [telegramActionPending, setTelegramActionPending] = useState(false);
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { isSubmitting },
  } = useForm<UpdateNotificationPreferencesInput>({
    resolver: zodResolver(updateNotificationPreferencesSchema),
    defaultValues: toFormValues(savedPreferences, userEmail),
  });
  const values = watch();
  const canUseEmail = Boolean(userEmail);
  const canUseTelegram = savedPreferences.telegram.enabled;

  const submit = handleSubmit(async (input) => {
    const payload = {
      ...input,
      emailEnabled: canUseEmail ? input.emailEnabled : false,
      telegramEnabled: canUseTelegram ? input.telegramEnabled : false,
    };
    const result = await updateNotificationPreferences(organizationId, payload);

    if (result.ok) {
      const nextPreferences = result.data;
      setSavedPreferences(nextPreferences);
      reset(toFormValues(nextPreferences, userEmail));
      toast.success(t('saved'));
      return;
    }

    toast.error(result.error);
  });

  const connectTelegram = async () => {
    if (telegramActionPending) return;
    setTelegramActionPending(true);

    try {
      const result = await createTelegramNotificationLink(organizationId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      window.open(result.data.url, '_blank', 'noopener,noreferrer');
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
    <form className="stack max-w-2xl" onSubmit={submit}>
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
            <Checkbox label={t('enabled')} {...register('inAppEnabled')} />
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
            <Checkbox disabled={!canUseEmail} label={t('enabled')} {...register('emailEnabled')} />
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
                disabled={!canUseTelegram}
                label={t('enabled')}
                {...register('telegramEnabled')}
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
            <Checkbox label={t('enabled')} {...register('taskAssignedEnabled')} />
          </PreferenceRow>
          <PreferenceRow
            offLabel={t('off')}
            onLabel={t('on')}
            title={t('serviceAssignments')}
            description={t('serviceAssignmentsDescription')}
            checked={values.serviceAssignedEnabled}
          >
            <Checkbox label={t('enabled')} {...register('serviceAssignedEnabled')} />
          </PreferenceRow>
          <PreferenceRow
            offLabel={t('off')}
            onLabel={t('on')}
            title={t('reminders')}
            description={t('remindersDescription')}
            checked={values.remindersEnabled}
          >
            <Checkbox label={t('enabled')} {...register('remindersEnabled')} />
          </PreferenceRow>
          <PreferenceRow
            offLabel={t('off')}
            onLabel={t('on')}
            title={t('birthdayDigest')}
            description={t('birthdayDigestDescription')}
            checked={values.birthdayDigestEnabled}
          >
            <Checkbox label={t('enabled')} {...register('birthdayDigestEnabled')} />
          </PreferenceRow>
        </div>
      </section>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          disabled={isSubmitting}
          onClick={() => reset(toFormValues(savedPreferences, userEmail))}
          type="button"
          variant="secondary"
        >
          {t('reset')}
        </Button>
        <Button disabled={isSubmitting} type="submit">
          {isSubmitting ? t('saving') : t('savePreferences')}
        </Button>
      </div>
    </form>
  );
}

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
  };
}
