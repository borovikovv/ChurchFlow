'use client';

import { useTranslations } from 'next-intl';
import type { WebsiteTemplateId } from '@churchflow/shared';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { FormSelect } from '@/components/forms/form-select';
import { updateSection } from '../form-actions';
import type { DashboardSection } from '../types';
import {
  SECTION_VARIANTS,
  sectionDefinition,
  sectionVariantsForTemplate,
} from '../website-section-presets';
import { SectionFields } from './section-fields';
import { sectionEditorKey } from './website-editor-state';
import type { SubmitWebsiteForm } from './website-editor.types';

export function SectionInspector({
  organizationId,
  pendingKey,
  section,
  submitForm,
  template,
}: {
  organizationId: string;
  pendingKey: string | null;
  section: DashboardSection | undefined;
  submitForm: SubmitWebsiteForm;
  template: WebsiteTemplateId;
}) {
  const t = useTranslations('website');

  if (!section) {
    return (
      <aside className="grid content-start gap-2 rounded-md border border-[var(--line)] bg-[var(--surface)] p-4">
        <h3 className="m-0">{t('inspector')}</h3>
        <p className="m-0 text-sm text-[var(--muted)]">{t('selectSectionHint')}</p>
      </aside>
    );
  }

  return (
    <SectionForm
      key={sectionEditorKey(section)}
      organizationId={organizationId}
      pending={pendingKey === `section:${section.id}:update`}
      section={section}
      submitForm={submitForm}
      template={template}
    />
  );
}

function SectionForm({
  organizationId,
  pending,
  section,
  submitForm,
  template,
}: {
  organizationId: string;
  pending: boolean;
  section: DashboardSection;
  submitForm: SubmitWebsiteForm;
  template: WebsiteTemplateId;
}) {
  const t = useTranslations('website');
  const definition = sectionDefinition(section, template);
  const variantOptions = [
    ...sectionVariantsForTemplate(template).filter((option) => option.type === section.type),
    ...SECTION_VARIANTS.filter(
      (option) => option.type === section.type && !option.templates.includes(template),
    ),
  ];

  return (
    <aside className="grid content-start gap-3 rounded-md border border-[var(--line)] bg-[var(--surface)] p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="m-0">{t(`sectionTypes.${section.type}`)}</h3>
        <span className="text-xs text-[var(--muted)]">
          {t('sectionPosition', { position: section.order + 1 })}
        </span>
      </div>
      <form
        className="grid gap-3"
        action={(formData) =>
          void submitForm(updateSection, formData, `section:${section.id}:update`)
        }
      >
        <input type="hidden" name="organizationId" value={organizationId} />
        <input type="hidden" name="sectionId" value={section.id} />
        <input type="hidden" name="type" value={section.type} />
        <input type="hidden" name="order" value={section.order} />
        {variantOptions.length > 1 ? (
          <FormSelect label={t('variant')} name="variant" defaultValue={definition.variant}>
            {variantOptions.map((option) => (
              <option key={option.variant} value={option.variant}>
                {t(`variants.${option.variant}`)}
              </option>
            ))}
          </FormSelect>
        ) : (
          <input type="hidden" name="variant" value={definition.variant} />
        )}
        <SectionFields fields={definition.fields} section={section} template={template} />
        <Checkbox
          defaultChecked={section.hidden}
          label={t('hideSection')}
          name="hidden"
          value="true"
        />
        <Button type="submit" disabled={pending}>
          {pending ? t('saving') : t('saveSection')}
        </Button>
      </form>
    </aside>
  );
}
