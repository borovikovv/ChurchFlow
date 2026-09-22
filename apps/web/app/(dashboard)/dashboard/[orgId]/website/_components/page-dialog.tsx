'use client';

import { useId, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { websiteTemplatePagePresets } from '@churchflow/shared';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { FormDialog } from '@/components/ui/form-dialog';
import { FormSelect } from '@/components/forms/form-select';
import { createPage, updatePage } from '../form-actions';
import type { DashboardPage, DashboardWebsite } from '../types';
import { PAGE_STATUSES, readString } from '../website-form-utils';
import { OgImageFields } from './og-image-fields';
import type { SubmitWebsiteForm } from './website-editor.types';

export function PageDialog({
  organizationId,
  page,
  pending,
  submitForm,
  website,
}: {
  organizationId: string;
  page?: DashboardPage | undefined;
  pending: boolean;
  submitForm: SubmitWebsiteForm;
  website: DashboardWebsite;
}) {
  const t = useTranslations('website');
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formId = useId();
  const pendingKey = page ? `page:${page.id}:update` : 'page-create';
  const seo = page?.seo ?? {};
  const presets = websiteTemplatePagePresets(website.settings.template);

  return (
    <FormDialog
      dialogRef={dialogRef}
      size="md"
      title={page ? t('pageSettings') : t('createPage')}
      triggerLabel={page ? t('pageSettings') : t('createPage')}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={() => dialogRef.current?.close()}>
            {t('cancel')}
          </Button>
          <Button type="submit" form={formId} disabled={pending}>
            {pending ? t('saving') : page ? t('savePage') : t('createPage')}
          </Button>
        </>
      }
    >
      <form
        className="grid gap-3"
        id={formId}
        key={page ? JSON.stringify([page.slug, page.title, page.status, page.seo]) : 'new'}
        action={async (formData) => {
          if (await submitForm(page ? updatePage : createPage, formData, pendingKey)) {
            dialogRef.current?.close();
          }
        }}
      >
        <input type="hidden" name="organizationId" value={organizationId} />
        {page ? <input type="hidden" name="pageId" value={page.id} /> : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <label>
            {t('slug')}
            <input
              name="slug"
              required
              maxLength={80}
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              placeholder={t('placeholders.aboutSlug')}
              defaultValue={page?.slug ?? ''}
            />
          </label>
          <label>
            {t('pageTitle')}
            <input
              name="title"
              required
              maxLength={160}
              placeholder={t('placeholders.aboutTitle')}
              defaultValue={page?.title ?? ''}
            />
          </label>
        </div>
        <FormSelect label={t('status')} name="status" defaultValue={page?.status ?? 'DRAFT'}>
          {PAGE_STATUSES.map((status) => (
            <option key={status} value={status}>
              {t(`statuses.${status}`)}
            </option>
          ))}
        </FormSelect>
        {!page && presets.length > 0 ? (
          <>
            <FormSelect label={t('startFrom')} name="preset" defaultValue="">
              <option value="">{t('pagePresets.empty')}</option>
              {presets.map((preset) => (
                <option key={preset} value={preset}>
                  {t(`pagePresets.${preset}`)}
                </option>
              ))}
            </FormSelect>
            <span className="text-xs text-[var(--muted)]">{t('startFromHint')}</span>
          </>
        ) : null}
        {!page ? <Checkbox label={t('addToMenu')} name="addToMenu" value="true" /> : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <label>
            {t('seoTitle')}
            <input name="seoTitle" maxLength={160} defaultValue={readString(seo, 'title')} />
          </label>
          <label>
            {t('seoDescription')}
            <input
              name="seoDescription"
              maxLength={300}
              defaultValue={readString(seo, 'description')}
            />
          </label>
        </div>
        <Checkbox
          defaultChecked={seo['noindex'] === true}
          label={t('noindex')}
          name="noindex"
          value="true"
        />
        <OgImageFields
          ogImageAssetId={readString(seo, 'ogImageAssetId')}
          ogImageUrl={readString(seo, 'ogImageUrl')}
        />
      </form>
    </FormDialog>
  );
}
