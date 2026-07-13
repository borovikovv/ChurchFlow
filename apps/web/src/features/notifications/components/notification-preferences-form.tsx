'use client';

import {
  updateNotificationPreferencesSchema,
  type NotificationPreferences,
  type UpdateNotificationPreferencesInput,
} from '@churchflow/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'react-toastify';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { updateNotificationPreferences } from '../server/actions';

export function NotificationPreferencesForm({
  organizationId,
  preferences,
  userEmail,
}: {
  organizationId: string;
  preferences: NotificationPreferences;
  userEmail: string | null;
}) {
  const [savedPreferences, setSavedPreferences] = useState(preferences);
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
      toast.success('Notification preferences updated.');
      return;
    }

    toast.error(result.error);
  });

  return (
    <form className="stack max-w-2xl" onSubmit={submit}>
      <section className="stack rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] p-6 shadow-[var(--shadow)]">
        <div className="stack gap-1">
          <h2 className="m-0 text-2xl">Delivery channels</h2>
          <p className="m-0 text-[var(--muted)]">
            Choose where ChurchFlow should send notifications for this organization.
          </p>
        </div>

        <div className="grid gap-4">
          <PreferenceRow
            title="In-app"
            description="Show notifications in the header inbox."
            checked={values.inAppEnabled}
          >
            <Checkbox label="Enabled" {...register('inAppEnabled')} />
          </PreferenceRow>

          <PreferenceRow
            title="Email"
            description={
              canUseEmail
                ? `Send notification emails to ${userEmail}.`
                : 'Add an email address in your profile before enabling email notifications.'
            }
            checked={values.emailEnabled && canUseEmail}
          >
            <Checkbox disabled={!canUseEmail} label="Enabled" {...register('emailEnabled')} />
          </PreferenceRow>

          <PreferenceRow
            title="Telegram"
            description={telegramDescription(savedPreferences.telegram)}
            checked={values.telegramEnabled && canUseTelegram}
          >
            <div className="flex flex-wrap items-center gap-2">
              <Checkbox
                disabled={!canUseTelegram}
                label="Enabled"
                {...register('telegramEnabled')}
              />
              <Button
                disabled
                type="button"
                variant="secondary"
                className="min-h-8 px-2 py-1 text-xs"
              >
                Connect bot
              </Button>
            </div>
          </PreferenceRow>
        </div>
      </section>

      <section className="stack rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] p-6 shadow-[var(--shadow)]">
        <div className="stack gap-1">
          <h2 className="m-0 text-2xl">Notification types</h2>
          <p className="m-0 text-[var(--muted)]">
            Pick which organization activity should create notifications.
          </p>
        </div>

        <div className="grid gap-3">
          <Checkbox label="Task assignments" {...register('taskAssignedEnabled')} />
          <Checkbox label="Service assignments" {...register('serviceAssignedEnabled')} />
          <Checkbox label="Reminders" {...register('remindersEnabled')} />
        </div>
      </section>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          disabled={isSubmitting}
          onClick={() => reset(toFormValues(savedPreferences, userEmail))}
          type="button"
          variant="secondary"
        >
          Reset
        </Button>
        <Button disabled={isSubmitting} type="submit">
          {isSubmitting ? 'Saving...' : 'Save preferences'}
        </Button>
      </div>
    </form>
  );
}

function PreferenceRow({
  title,
  description,
  checked,
  children,
}: {
  title: string;
  description: string;
  checked: boolean;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-3 rounded-[var(--radius)] border border-[var(--line)] p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="stack gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="m-0 text-base">{title}</h3>
          <StatusBadge status={checked ? 'ON' : 'OFF'} />
        </div>
        <p className="m-0 text-sm text-[var(--muted)]">{description}</p>
      </div>
      {children}
    </div>
  );
}

function telegramDescription(preferences: NotificationPreferences['telegram']): string {
  if (preferences.blockedAt)
    return 'Telegram is blocked. Open the bot and unblock it to reconnect.';
  if (preferences.revokedAt)
    return 'Telegram access was disconnected. Reconnect the bot to use it.';
  if (preferences.enabled) {
    return preferences.username
      ? `Send Telegram messages to @${preferences.username}.`
      : 'Send Telegram messages through the connected bot chat.';
  }

  return 'Connect the Telegram bot before enabling Telegram notifications.';
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
  };
}
