'use client';

import { useId, useRef } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { APP_LOCALES, WEBSITE_LIVE_MODES, WEBSITE_NAVIGATION_MAX_LINKS } from '@churchflow/shared';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { FormDialog } from '@/components/ui/form-dialog';
import { FormRepeater, type RepeaterField } from '@/components/forms/form-repeater';
import { FormSelect, type SelectOption } from '@/components/forms/form-select';
import { updateSettings } from '../form-actions';
import type { DashboardWebsite } from '../types';
import {
  NAVIGATION_ROW_NAMES,
  SERVICE_TIME_ROW_NAMES,
  linkRows,
  serviceTimeRows,
} from '../website-form-utils';
import { templateReadsStyleControl } from '../website-template-fields';
import { OgImageFields } from './og-image-fields';
import type { SubmitWebsiteForm } from './website-editor.types';

// Mirrors the limit websiteSettingsSchema puts on the stored list.
const MAX_SERVICE_TIMES = 10;
// A Sunday, so the weekday numbers the schema stores (0 = Sunday) map straight onto the offsets.
const WEEKDAY_ANCHOR = Date.UTC(2026, 8, 13);

export function WebsiteSettingsDialog({
  organizationId,
  pending,
  submitForm,
  website,
}: {
  organizationId: string;
  pending: boolean;
  submitForm: SubmitWebsiteForm;
  website: DashboardWebsite;
}) {
  const t = useTranslations('website');
  const editorLocale = useLocale();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formId = useId();
  const { settings, theme } = website;
  const navigationFields: RepeaterField[] = [
    {
      kind: 'text',
      key: 'label',
      label: t('fields.linkLabel'),
      maxLength: 80,
      name: NAVIGATION_ROW_NAMES.label,
      required: true,
    },
    {
      kind: 'text',
      key: 'href',
      label: t('fields.linkUrl'),
      name: NAVIGATION_ROW_NAMES.href,
      placeholder: t('fields.hrefPlaceholder'),
      required: true,
    },
  ];
  const serviceTimeFields: RepeaterField[] = [
    {
      kind: 'select',
      key: 'weekday',
      label: t('serviceTimeDay'),
      name: SERVICE_TIME_ROW_NAMES.weekday,
      options: weekdayOptions(editorLocale),
    },
    {
      kind: 'text',
      key: 'time',
      label: t('serviceTimeStart'),
      name: SERVICE_TIME_ROW_NAMES.time,
      required: true,
      type: 'time',
    },
    {
      defaultValue: '90',
      kind: 'number',
      key: 'durationMinutes',
      label: t('serviceTimeDuration'),
      max: 360,
      min: 15,
      name: SERVICE_TIME_ROW_NAMES.durationMinutes,
      required: true,
    },
    {
      kind: 'text',
      key: 'label',
      label: t('serviceTimeLabel'),
      maxLength: 80,
      name: SERVICE_TIME_ROW_NAMES.label,
    },
  ];

  return (
    <FormDialog
      dialogRef={dialogRef}
      fullScreenOnMobile
      size="lg"
      title={t('websiteSettings')}
      triggerLabel={t('websiteSettings')}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={() => dialogRef.current?.close()}>
            {t('cancel')}
          </Button>
          <Button type="submit" form={formId} disabled={pending}>
            {pending ? t('saving') : t('saveSettings')}
          </Button>
        </>
      }
    >
      <form
        className="grid gap-5"
        id={formId}
        key={JSON.stringify([website.title, website.description, theme, settings])}
        action={async (formData) => {
          if (await submitForm(updateSettings, formData, 'website-settings')) {
            dialogRef.current?.close();
          }
        }}
      >
        <input type="hidden" name="organizationId" value={organizationId} />

        <Fieldset title={t('settingsGroups.brand')}>
          <label>
            {t('websiteTitle')}
            <input name="title" required maxLength={160} defaultValue={website.title} />
          </label>
          <label>
            {t('websiteDescription')}
            <textarea
              name="description"
              maxLength={500}
              rows={2}
              defaultValue={website.description ?? ''}
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              {t('accentColor')}
              <input name="accent" defaultValue={theme.accent} />
            </label>
            {/* The colour stays stored while a template that ignores it is active, so switching
                back to one that paints with it finds it unchanged. */}
            {templateReadsStyleControl(settings.template, 'themeBackground') ? (
              <label>
                {t('background')}
                <input name="background" defaultValue={theme.background} />
              </label>
            ) : (
              <input name="background" type="hidden" value={theme.background} />
            )}
            <FormSelect label={t('siteLocale')} name="locale" defaultValue={settings.locale}>
              {APP_LOCALES.map((locale) => (
                <option key={locale} value={locale}>
                  {t(`locales.${locale}`)}
                </option>
              ))}
            </FormSelect>
            <label>
              {t('timeZone')}
              <input name="timeZone" placeholder="Europe/Kyiv" defaultValue={settings.timeZone} />
            </label>
          </div>
        </Fieldset>

        <Fieldset title={t('settingsGroups.navigation')}>
          <FormRepeater
            addLabel={t('addMenuLink')}
            fields={navigationFields}
            hint={t('navigationHint')}
            label={t('navigationLinks')}
            maxRows={WEBSITE_NAVIGATION_MAX_LINKS}
            rows={linkRows(settings.navigation)}
          />
        </Fieldset>

        <Fieldset title={t('settingsGroups.location')}>
          <label>
            {t('address')}
            <input name="address" maxLength={300} defaultValue={settings.location.address ?? ''} />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              {t('addressNote')}
              <input
                name="addressNote"
                maxLength={300}
                defaultValue={settings.location.addressNote ?? ''}
              />
            </label>
            <label>
              {t('directionsUrl')}
              <input
                name="directionsUrl"
                placeholder="https://maps.google.com/..."
                defaultValue={settings.location.directionsUrl ?? ''}
              />
            </label>
          </div>
          <FormRepeater
            addLabel={t('addServiceTime')}
            fields={serviceTimeFields}
            hint={t('serviceTimesHint')}
            label={t('serviceTimes')}
            maxRows={MAX_SERVICE_TIMES}
            rows={serviceTimeRows(settings.serviceTimes)}
          />
        </Fieldset>

        <Fieldset title={t('settingsGroups.live')}>
          <label>
            {t('liveUrl')}
            <input
              name="liveUrl"
              placeholder="https://youtube.com/@church/live"
              defaultValue={settings.live.url ?? ''}
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormSelect label={t('liveMode')} name="liveMode" defaultValue={settings.live.mode}>
              {WEBSITE_LIVE_MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {t(`liveModes.${mode}`)}
                </option>
              ))}
            </FormSelect>
            <label>
              {t('leadMinutes')}
              <input
                name="leadMinutes"
                type="number"
                min={0}
                max={60}
                defaultValue={settings.live.leadMinutes}
              />
            </label>
          </div>
          <Checkbox
            defaultChecked={settings.live.isLive}
            label={t('isLiveNow')}
            name="isLive"
            value="true"
          />
          <p className="m-0 text-xs text-[var(--muted)]">{t('liveHint')}</p>
        </Fieldset>

        <Fieldset title={t('settingsGroups.socials')}>
          <div className="grid gap-3 sm:grid-cols-2">
            {(['facebook', 'instagram', 'youtube', 'telegram'] as const).map((network) => (
              <label key={network}>
                {t(`socials.${network}`)}
                <input name={network} defaultValue={settings.socials[network] ?? ''} />
              </label>
            ))}
          </div>
        </Fieldset>

        <Fieldset title={t('settingsGroups.seo')}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              {t('seoTitle')}
              <input name="seoTitle" maxLength={160} defaultValue={settings.seo.title ?? ''} />
            </label>
            <label>
              {t('seoDescription')}
              <input
                name="seoDescription"
                maxLength={300}
                defaultValue={settings.seo.description ?? ''}
              />
            </label>
          </div>
          <Checkbox
            defaultChecked={settings.seo.noindex}
            label={t('noindex')}
            name="noindex"
            value="true"
          />
          <OgImageFields
            ogImageAssetId={settings.seo.ogImageAssetId ?? ''}
            ogImageUrl={settings.seo.ogImageUrl ?? ''}
          />
        </Fieldset>
      </form>
    </FormDialog>
  );
}

// The day names come from the platform rather than from the message files, which keeps the select
// in the editor's language without a second list of weekdays to translate and keep in step.
function weekdayOptions(locale: string): SelectOption[] {
  const format = new Intl.DateTimeFormat(locale, { timeZone: 'UTC', weekday: 'long' });

  return Array.from({ length: 7 }, (_, weekday) => ({
    label: format.format(WEEKDAY_ANCHOR + weekday * 24 * 60 * 60 * 1000),
    value: String(weekday),
  }));
}

function Fieldset({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <fieldset className="m-0 grid gap-3 border-0 border-t border-[var(--line-muted)] p-0 pt-4 first:border-t-0 first:pt-0">
      <legend className="filter-label mb-1 px-0">{title}</legend>
      {children}
    </fieldset>
  );
}
