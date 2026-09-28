'use client';

import Image from 'next/image';
import { useId, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { WEBSITE_TEMPLATES, type WebsiteTemplateId } from '@churchflow/shared';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { FormDialog } from '@/components/ui/form-dialog';
import { StatusBadge } from '@/components/ui/status-badge';
import { applyTemplate } from '../form-actions';
import type { SubmitWebsiteForm } from './website-editor.types';

const TEMPLATE_PREVIEW_WIDTH = 320;
const TEMPLATE_PREVIEW_HEIGHT = 200;

export function TemplateDialog({
  currentTemplate,
  organizationId,
  pending,
  submitForm,
}: {
  currentTemplate: WebsiteTemplateId;
  organizationId: string;
  pending: boolean;
  submitForm: SubmitWebsiteForm;
}) {
  const t = useTranslations('website');
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formId = useId();

  return (
    <FormDialog
      dialogRef={dialogRef}
      size="md"
      title={t('templateDialogTitle')}
      triggerLabel={t('changeTemplate')}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={() => dialogRef.current?.close()}>
            {t('cancel')}
          </Button>
          <Button type="submit" form={formId} disabled={pending}>
            {pending ? t('saving') : t('applyTemplate')}
          </Button>
        </>
      }
    >
      <form
        className="grid gap-4"
        id={formId}
        action={async (formData) => {
          if (await submitForm(applyTemplate, formData, 'website-template')) {
            dialogRef.current?.close();
          }
        }}
      >
        <input type="hidden" name="organizationId" value={organizationId} />
        <p className="m-0 text-sm text-[var(--muted)]">{t('templateDialogDescription')}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {WEBSITE_TEMPLATES.map((template) => (
            <label
              className="grid cursor-pointer gap-2 rounded-md border border-[var(--line)] p-3 has-[:checked]:border-[var(--accent)] has-[:checked]:shadow-[0_0_0_3px_rgba(9,105,218,0.2)]"
              key={template}
            >
              <Image
                alt={t('templatePreviewAlt', { template: t(`templates.${template}.name`) })}
                className="h-auto w-full rounded-[var(--radius)] border border-[var(--line)]"
                height={TEMPLATE_PREVIEW_HEIGHT}
                src={`/images/website-templates/${template}.svg`}
                width={TEMPLATE_PREVIEW_WIDTH}
              />
              <span className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 font-semibold">
                  <input
                    className="m-0 h-4 w-4"
                    defaultChecked={template === currentTemplate}
                    name="templateId"
                    type="radio"
                    value={template}
                  />
                  {t(`templates.${template}.name`)}
                </span>
                {template === currentTemplate ? (
                  <StatusBadge label={t('currentTemplate')} status="on" />
                ) : null}
              </span>
              <span className="text-sm text-[var(--muted)]">
                {t(`templates.${template}.description`)}
              </span>
            </label>
          ))}
        </div>
        <div className="grid gap-3 rounded-md border border-[var(--line)] bg-[var(--surface-subtle)] p-3 text-sm">
          <p className="m-0">
            <strong>{t('templateKeepsContent')}</strong> {t('templateKeepsContentHint')}
          </p>
          <Checkbox
            defaultChecked
            label={t('addMissingSections')}
            name="addMissingSections"
            value="true"
          />
          <Checkbox label={t('resetTheme')} name="resetTheme" value="true" />
        </div>
      </form>
    </FormDialog>
  );
}
