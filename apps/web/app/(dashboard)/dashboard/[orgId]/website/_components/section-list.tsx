'use client';

import { useTranslations } from 'next-intl';
import type { WebsiteTemplateId } from '@churchflow/shared';
import { ActionMenuButton } from '@/components/ui/action-menu-button';
import { FormSelect } from '@/components/forms/form-select';
import { StatusBadge } from '@/components/ui/status-badge';
import {
  createSection,
  deleteSection,
  duplicateSection,
  reorderSections,
  setSectionHidden,
} from '../form-actions';
import type { DashboardPage, DashboardSection } from '../types';
import {
  isRenderableByTemplate,
  sectionDefinition,
  sectionVariantsForTemplate,
} from '../website-section-presets';
import { formDataOf, type SubmitWebsiteForm } from './website-editor.types';

export function SectionList({
  onSelectPage,
  onSelectSection,
  organizationId,
  page,
  pages,
  pendingKey,
  selectedSectionId,
  submitForm,
  template,
}: {
  onSelectPage: (pageId: string) => void;
  onSelectSection: (sectionId: string) => void;
  organizationId: string;
  page: DashboardPage | undefined;
  pages: DashboardPage[];
  pendingKey: string | null;
  selectedSectionId: string | null;
  submitForm: SubmitWebsiteForm;
  template: WebsiteTemplateId;
}) {
  const t = useTranslations('website');
  const sections = page?.sections ?? [];
  const sectionIds = sections.map((section) => section.id).join(',');
  const variants = sectionVariantsForTemplate(template);

  return (
    <aside className="grid content-start gap-3 rounded-md border border-[var(--line)] bg-[var(--surface)] p-3">
      <FormSelect
        label={t('page')}
        name="pageId"
        value={page?.id ?? ''}
        onChange={(event) => onSelectPage(event.currentTarget.value)}
      >
        {pages.map((option) => (
          <option key={option.id} value={option.id}>
            {option.title} · /{option.slug}
          </option>
        ))}
      </FormSelect>

      <div className="flex items-center justify-between">
        <span className="filter-label">{t('sections')}</span>
        <span className="text-xs text-[var(--muted)]">{sections.length}</span>
      </div>

      {sections.length === 0 ? (
        <p className="m-0 text-sm text-[var(--muted)]">{t('noSections')}</p>
      ) : null}

      <ol className="m-0 grid list-none gap-1 p-0">
        {sections.map((section, index) => (
          <SectionRow
            index={index}
            key={section.id}
            onSelect={() => onSelectSection(section.id)}
            organizationId={organizationId}
            pageId={page?.id ?? ''}
            pending={pendingKey?.startsWith(`section:${section.id}`) ?? false}
            renderable={isRenderableByTemplate(section.type, template)}
            section={section}
            sectionIds={sectionIds}
            selected={section.id === selectedSectionId}
            submitForm={submitForm}
            template={template}
            total={sections.length}
          />
        ))}
      </ol>

      {page ? (
        <ActionMenuButton
          className="ui-button-secondary w-full justify-center"
          label={t('addSection')}
          items={variants.map((definition) => ({
            label: `${t(`sectionTypes.${definition.type}`)} · ${t(`variants.${definition.variant}`)}`,
            onSelect: () =>
              void submitForm(
                createSection,
                formDataOf({
                  organizationId,
                  pageId: page.id,
                  templateId: template,
                  type: definition.type,
                  variant: definition.variant,
                  order: sections.length,
                }),
                `page:${page.id}:section-create`,
              ),
          }))}
        />
      ) : null}
    </aside>
  );
}

function SectionRow({
  index,
  onSelect,
  organizationId,
  pageId,
  pending,
  renderable,
  section,
  sectionIds,
  selected,
  submitForm,
  template,
  total,
}: {
  index: number;
  onSelect: () => void;
  organizationId: string;
  pageId: string;
  pending: boolean;
  renderable: boolean;
  section: DashboardSection;
  sectionIds: string;
  selected: boolean;
  submitForm: SubmitWebsiteForm;
  template: WebsiteTemplateId;
  total: number;
}) {
  const t = useTranslations('website');
  const definition = sectionDefinition(section, template);
  const move = (toIndex: number) =>
    void submitForm(
      reorderSections,
      formDataOf({ organizationId, pageId, sectionIds, fromIndex: index, toIndex }),
      `section:${section.id}:move`,
    );
  const base = { organizationId, pageId, sectionId: section.id };

  return (
    <li
      className={`flex items-center gap-2 rounded-md px-2 py-1.5 ${
        selected
          ? 'bg-[#ddf4ff] shadow-[inset_3px_0_0_var(--accent)]'
          : 'hover:bg-[var(--surface-subtle)]'
      } ${pending ? 'opacity-60' : ''}`}
    >
      <button
        className="flex min-w-0 flex-1 cursor-pointer flex-col items-start border-0 bg-transparent p-0 text-left font-[inherit]"
        onClick={onSelect}
        type="button"
      >
        <span
          className={`font-semibold ${section.hidden || !renderable ? 'text-[var(--muted)]' : ''}`}
        >
          {t(`sectionTypes.${section.type}`)}
        </span>
        <span className="text-xs text-[var(--muted)]">
          {t(`variants.${definition.variant}`)}
          {section.hidden ? ` · ${t('hidden')}` : ''}
          {!renderable ? ` · ${t('notInTemplate')}` : ''}
        </span>
      </button>
      {section.hidden ? <StatusBadge label={t('hidden')} status="off" /> : null}
      <ActionMenuButton
        className="ui-button-ghost px-2"
        label={t('sectionActions')}
        size="medium"
        items={[
          ...(index > 0 ? [{ label: t('up'), onSelect: () => move(index - 1) }] : []),
          ...(index < total - 1 ? [{ label: t('down'), onSelect: () => move(index + 1) }] : []),
          {
            label: section.hidden ? t('show') : t('hide'),
            onSelect: () =>
              void submitForm(
                setSectionHidden,
                formDataOf({ ...base, hidden: !section.hidden }),
                `section:${section.id}:hidden`,
              ),
          },
          {
            label: t('duplicate'),
            onSelect: () =>
              void submitForm(
                duplicateSection,
                formDataOf(base),
                `section:${section.id}:duplicate`,
              ),
          },
          {
            label: t('delete'),
            onSelect: () => {
              if (window.confirm(t('confirmDeleteSection'))) {
                void submitForm(deleteSection, formDataOf(base), `section:${section.id}:delete`);
              }
            },
          },
        ]}
      />
    </li>
  );
}
