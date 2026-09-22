'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'react-toastify';
import { Button, ButtonLink } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { StatusBadge } from '@/components/ui/status-badge';
import { setPagePublished, setWebsitePublished } from '../form-actions';
import type { DashboardPage, DashboardWebsite, WebsiteFeedback } from '../types';
import { PageDialog } from './page-dialog';
import { SectionInspector } from './section-inspector';
import { SectionList } from './section-list';
import { TemplateDialog } from './template-dialog';
import { applyWebsiteMutation, type WebsiteEditorState } from './website-editor-state';
import { formDataOf, type SubmitWebsiteForm } from './website-editor.types';
import {
  OG_IMAGE_FIELDS,
  SECTION_BACKGROUND_IMAGE_FIELDS,
  uploadWebsiteImage,
} from './website-image-upload';
import { WebsitePreview } from './website-preview';
import { WebsiteSettingsDialog } from './website-settings-dialog';

export function WebsiteEditor({
  feedback,
  organizationId,
  pages,
  publicUrl,
  website,
}: {
  feedback: WebsiteFeedback;
  organizationId: string;
  pages: DashboardPage[];
  publicUrl: string;
  website: DashboardWebsite;
}) {
  const t = useTranslations('website');
  const [state, setState] = useState<WebsiteEditorState>({ website, pages });
  const [feedbackState, setFeedbackState] = useState<WebsiteFeedback>(feedback);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(
    () => pages.find((page) => page.slug === 'home')?.id ?? pages[0]?.id ?? null,
  );
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [previewVersion, setPreviewVersion] = useState(0);

  const currentPage =
    state.pages.find((page) => page.id === selectedPageId) ?? state.pages[0] ?? undefined;
  const currentSection = currentPage?.sections.find((section) => section.id === selectedSectionId);
  const template = state.website.settings.template;
  const published = Boolean(state.website.publishedAt);

  const submitForm: SubmitWebsiteForm = async (action, formData, nextPendingKey) => {
    setPendingKey(nextPendingKey);
    try {
      const uploads = [
        [
          SECTION_BACKGROUND_IMAGE_FIELDS,
          {
            tooLarge: t('backgroundImageTooLarge'),
            uploadFailed: t('backgroundImageUploadFailed'),
            wrongType: t('chooseBackgroundImage'),
          },
        ],
        [
          OG_IMAGE_FIELDS,
          {
            tooLarge: t('ogImageTooLarge'),
            uploadFailed: t('ogImageUploadFailed'),
            wrongType: t('chooseOgImage'),
          },
        ],
      ] as const;
      for (const [fields, messages] of uploads) {
        const uploadResult = await uploadWebsiteImage(formData, fields, messages);
        if (!uploadResult.ok) {
          setFeedbackState({ error: uploadResult.error });
          toast.error(uploadResult.error);
          return false;
        }
      }

      const result = await action(formData);
      if (!result.ok) {
        setFeedbackState({ error: result.error });
        toast.error(result.error);
        return false;
      }

      setState((current) => applyWebsiteMutation(current, result.mutation));
      if (result.mutation.type === 'page-created') setSelectedPageId(result.mutation.page.id);
      if (result.mutation.type === 'section-created') {
        setSelectedSectionId(result.mutation.section.id);
      }
      if (result.mutation.type === 'section-deleted') setSelectedSectionId(null);
      if (result.mutation.type === 'template-applied' && result.mutation.page) {
        setSelectedPageId(result.mutation.page.id);
      }
      setPreviewVersion((version) => version + 1);
      setFeedbackState({ message: result.message });
      toast.success(result.message);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : t('unableToSave');
      setFeedbackState({ error: message });
      toast.error(message);
      return false;
    } finally {
      setPendingKey(null);
    }
  };

  return (
    <main className="stack min-w-0 content-start">
      <PageHeader
        title={t('title')}
        description={t('templateInUse', { template: t(`templates.${template}.name`) })}
        actions={
          <div className="actions">
            <StatusBadge
              label={t(`statuses.${published ? 'PUBLISHED' : 'DRAFT'}`)}
              status={published ? 'PUBLISHED' : 'DRAFT'}
            />
            <ButtonLink href={publicUrl} variant="secondary">
              {t('openPublicSite')}
            </ButtonLink>
            <Button
              type="button"
              variant={published ? 'secondary' : 'primary'}
              disabled={pendingKey === 'website-published'}
              onClick={() =>
                void submitForm(
                  setWebsitePublished,
                  formDataOf({ organizationId, published: !published }),
                  'website-published',
                )
              }
            >
              {pendingKey === 'website-published'
                ? t('saving')
                : published
                  ? t('unpublish')
                  : t('publish')}
            </Button>
          </div>
        }
      />

      {feedbackState.error ? <p className="form-error">{feedbackState.error}</p> : null}

      <div className="actions">
        <TemplateDialog
          currentTemplate={template}
          organizationId={organizationId}
          pending={pendingKey === 'website-template'}
          submitForm={submitForm}
        />
        <WebsiteSettingsDialog
          organizationId={organizationId}
          pending={pendingKey === 'website-settings'}
          submitForm={submitForm}
          website={state.website}
        />
        <PageDialog
          organizationId={organizationId}
          pending={pendingKey === 'page-create'}
          submitForm={submitForm}
        />
        {currentPage ? (
          <>
            <PageDialog
              organizationId={organizationId}
              page={currentPage}
              pending={pendingKey === `page:${currentPage.id}:update`}
              submitForm={submitForm}
            />
            <Button
              type="button"
              variant="secondary"
              disabled={pendingKey === `page:${currentPage.id}:published`}
              onClick={() =>
                void submitForm(
                  setPagePublished,
                  formDataOf({
                    organizationId,
                    pageId: currentPage.id,
                    published: !currentPage.publishedAt,
                  }),
                  `page:${currentPage.id}:published`,
                )
              }
            >
              {currentPage.publishedAt ? t('unpublishPage') : t('publishPage')}
            </Button>
            <StatusBadge label={t(`statuses.${currentPage.status}`)} status={currentPage.status} />
            <span className="text-sm text-[var(--muted)]">
              {publicUrl}/{currentPage.slug}
            </span>
          </>
        ) : null}
      </div>

      <div className="grid min-w-0 gap-4 xl:grid-cols-[280px_minmax(0,1fr)_380px]">
        <SectionList
          onSelectPage={(pageId) => {
            setSelectedPageId(pageId);
            setSelectedSectionId(null);
          }}
          onSelectSection={setSelectedSectionId}
          organizationId={organizationId}
          page={currentPage}
          pages={state.pages}
          pendingKey={pendingKey}
          selectedSectionId={selectedSectionId}
          submitForm={submitForm}
          template={template}
        />
        <WebsitePreview
          organizationId={organizationId}
          pageId={currentPage?.id}
          version={previewVersion}
        />
        <SectionInspector
          organizationId={organizationId}
          pendingKey={pendingKey}
          section={currentSection}
          submitForm={submitForm}
          template={template}
        />
      </div>
    </main>
  );
}
