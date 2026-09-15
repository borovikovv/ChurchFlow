'use client';

import { useId, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { APP_LOCALES, WEBSITE_LIVE_MODES } from '@churchflow/shared';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { FormDialog } from '@/components/ui/form-dialog';
import { FormSelect } from '@/components/forms/form-select';
import { updateSettings } from '../form-actions';
import type { DashboardWebsite } from '../types';
import { formatLinks, formatServiceTimes } from '../website-form-utils';
import type { SubmitWebsiteForm } from './website-editor.types';

// Branding, navigation, service times, live stream, socials and SEO — everything that is not a
// section lives here and is shared by every page of the site.
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
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formId = useId();
  const { settings, theme } = website;

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
            <label>
              {t('background')}
              <input name="background" defaultValue={theme.background} />
            </label>
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
          <label>
            {t('navigationLinks')}
            <textarea
              name="navigation"
              rows={4}
              placeholder={t('fields.linksPlaceholder')}
              defaultValue={formatLinks(settings.navigation)}
            />
            <span className="text-xs text-[var(--muted)]">{t('navigationHint')}</span>
          </label>
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
          <label>
            {t('serviceTimes')}
            <textarea
              name="serviceTimes"
              rows={3}
              placeholder={t('serviceTimesPlaceholder')}
              defaultValue={formatServiceTimes(settings.serviceTimes)}
            />
            <span className="text-xs text-[var(--muted)]">{t('serviceTimesHint')}</span>
          </label>
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
        </Fieldset>
      </form>
    </FormDialog>
  );
}

function Fieldset({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <fieldset className="m-0 grid gap-3 border-0 border-t border-[var(--line-muted)] p-0 pt-4 first:border-t-0 first:pt-0">
      <legend className="filter-label mb-1 px-0">{title}</legend>
      {children}
    </fieldset>
  );
}
