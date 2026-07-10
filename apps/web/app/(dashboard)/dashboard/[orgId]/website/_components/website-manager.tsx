'use client';

import { useState } from 'react';
import { toast } from 'react-toastify';
import { Button, ButtonLink } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { FormSelect } from '@/components/forms/form-select';
import { PageHeader } from '@/components/ui/page-header';
import { StatusBadge } from '@/components/ui/status-badge';
import {
  confirmWebsiteSectionBackgroundImageAction,
  prepareWebsiteSectionBackgroundImageAction,
} from '../actions';
import type { DashboardPage, DashboardSection, DashboardWebsite, WebsiteFeedback } from '../types';
import {
  createPage,
  createSection,
  createStarterHome,
  deleteSection,
  reorderSections,
  setPagePublished,
  setWebsitePublished,
  updatePage,
  updateSection,
  updateSettings,
  type WebsiteFormResult,
} from '../form-actions';
import { formatItems, PAGE_STATUSES, readString } from '../website-form-utils';
import {
  SECTION_FONT_PRESETS,
  SECTION_PRESETS,
  sectionPreset,
  sectionVariant,
  sectionPresetValue,
  type SectionFieldGroup,
} from '../website-section-presets';

type WebsiteFormAction = (formData: FormData) => Promise<WebsiteFormResult>;
type SubmitWebsiteForm = (
  action: WebsiteFormAction,
  formData: FormData,
  pendingKey: string,
) => Promise<void>;

const allowedBackgroundImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const maxBackgroundImageBytes = 5 * 1024 * 1024;

export function WebsiteManager({
  feedback,
  organizationId,
  pages,
  publicUrl,
  slug,
  website,
}: {
  feedback: WebsiteFeedback;
  organizationId: string;
  pages: DashboardPage[];
  publicUrl: string;
  slug: string;
  website: DashboardWebsite;
}) {
  const [currentWebsite, setCurrentWebsite] = useState(website);
  const [currentPages, setCurrentPages] = useState(pages);
  const [currentFeedback, setCurrentFeedback] = useState<WebsiteFeedback>(feedback);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const homePage = currentPages.find((page) => page.slug === 'home');
  const submitForm: SubmitWebsiteForm = async (action, formData, nextPendingKey) => {
    setPendingKey(nextPendingKey);
    try {
      const uploadResult = await uploadSectionBackgroundImage(formData);
      if (!uploadResult.ok) {
        setCurrentFeedback({ error: uploadResult.error });
        toast.error(uploadResult.error);
        return;
      }

      const result = await action(formData);
      if (!result.ok) {
        setCurrentFeedback({ error: result.error });
        toast.error(result.error);
        return;
      }

      applyWebsiteMutation(result, setCurrentWebsite, setCurrentPages);
      setCurrentFeedback({ message: result.message });
      toast.success(result.message);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save website changes.';
      setCurrentFeedback({ error: message });
      toast.error(message);
    } finally {
      setPendingKey(null);
    }
  };

  return (
    <main className="stack min-w-0 content-start">
      <PageHeader
        title="Website"
        description="Publish and manage the public website for this organization."
        actions={
          <ButtonLink href={publicUrl} variant="secondary">
            Open public site
          </ButtonLink>
        }
      />

      <WebsiteFeedbackMessage feedback={currentFeedback} />
      <WebsiteStatusPanel
        isPending={pendingKey === 'website-published'}
        organizationId={organizationId}
        publicUrl={publicUrl}
        published={Boolean(currentWebsite.publishedAt)}
        submitForm={submitForm}
      />
      <WebsiteSettingsForm
        isPending={pendingKey === 'website-settings'}
        organizationId={organizationId}
        submitForm={submitForm}
        website={currentWebsite}
      />

      <section className="stack min-w-0 content-start">
        <div>
          <h2>Pages</h2>
          <p className="m-0 text-sm text-[var(--muted)]">
            Published pages are visible on the public website. The home page uses slug home.
          </p>
        </div>

        <StarterHomePanel
          homePage={homePage}
          isPending={pendingKey === 'starter-home'}
          organizationId={organizationId}
          submitForm={submitForm}
        />
        <CreatePageForm
          isPending={pendingKey === 'page-create'}
          organizationId={organizationId}
          submitForm={submitForm}
        />
        {currentPages.map((page) => (
          <PageEditor
            key={pageEditorKey(page)}
            organizationId={organizationId}
            page={page}
            pendingKey={pendingKey}
            slug={slug}
            submitForm={submitForm}
          />
        ))}
      </section>
    </main>
  );
}

function StarterHomePanel({
  homePage,
  isPending,
  organizationId,
  submitForm,
}: {
  homePage: DashboardPage | undefined;
  isPending: boolean;
  organizationId: string;
  submitForm: SubmitWebsiteForm;
}) {
  return (
    <section className="form-grid">
      <div className="grid gap-1">
        <h3 className="m-0">Starter home page</h3>
        <p className="m-0 text-sm text-[var(--muted)]">
          Add the editable starter structure: hero, contact, and footer.
        </p>
      </div>
      <form action={(formData) => submitForm(createStarterHome, formData, 'starter-home')}>
        <input type="hidden" name="organizationId" value={organizationId} />
        {homePage ? (
          <>
            <input type="hidden" name="pageId" value={homePage.id} />
            <input
              type="hidden"
              name="existingVariants"
              value={homePage.sections.map(sectionVariant).join(',')}
            />
          </>
        ) : null}
        <Button type="submit" variant="secondary" disabled={isPending}>
          {isPending
            ? 'Saving...'
            : homePage
              ? 'Add missing starter sections to home'
              : 'Create starter home page'}
        </Button>
      </form>
    </section>
  );
}

function WebsiteFeedbackMessage({ feedback }: { feedback: WebsiteFeedback }) {
  return (
    <>
      {feedback.error ? <p className="form-error">{feedback.error}</p> : null}
      {feedback.message ? (
        <p className="m-0 rounded-md border border-[rgba(31,136,61,0.25)] bg-[#dafbe1] px-3 py-2 text-sm font-semibold text-[var(--success-strong)]">
          {feedback.message}
        </p>
      ) : null}
    </>
  );
}

function WebsiteStatusPanel({
  isPending,
  organizationId,
  publicUrl,
  published,
  submitForm,
}: {
  isPending: boolean;
  organizationId: string;
  publicUrl: string;
  published: boolean;
  submitForm: SubmitWebsiteForm;
}) {
  return (
    <section className="form-grid">
      <div className="actions">
        <StatusBadge status={published ? 'PUBLISHED' : 'DRAFT'} />
        <span className="text-sm text-[var(--muted)]">{publicUrl}</span>
      </div>
      <form
        className="actions"
        action={(formData) => submitForm(setWebsitePublished, formData, 'website-published')}
      >
        <input type="hidden" name="organizationId" value={organizationId} />
        <input type="hidden" name="published" value={published ? 'false' : 'true'} />
        <Button type="submit" variant={published ? 'secondary' : 'primary'} disabled={isPending}>
          {isPending ? 'Saving...' : published ? 'Unpublish website' : 'Publish website'}
        </Button>
      </form>
    </section>
  );
}

function WebsiteSettingsForm({
  isPending,
  organizationId,
  submitForm,
  website,
}: {
  isPending: boolean;
  organizationId: string;
  submitForm: SubmitWebsiteForm;
  website: DashboardWebsite;
}) {
  return (
    <section className="form-grid">
      <h2 className="m-0">Website settings</h2>
      <form
        className="grid gap-3"
        action={(formData) => submitForm(updateSettings, formData, 'website-settings')}
      >
        <input type="hidden" name="organizationId" value={organizationId} />
        <label>
          Title
          <input name="title" required maxLength={160} defaultValue={website.title} />
        </label>
        <label>
          Description
          <textarea
            name="description"
            maxLength={500}
            rows={3}
            defaultValue={website.description ?? ''}
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-3">
          <FormSelect
            label="Template"
            name="template"
            defaultValue={readString(website.settings, 'template', 'default')}
          >
            <option value="default">Default sections</option>
          </FormSelect>
          <label>
            Accent color
            <input name="accent" defaultValue={readString(website.theme, 'accent', '#1f883d')} />
          </label>
          <label>
            Background
            <input
              name="background"
              defaultValue={readString(website.theme, 'background', '#ffffff')}
            />
          </label>
        </div>
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Saving...' : 'Save settings'}
        </Button>
      </form>
    </section>
  );
}

function CreatePageForm({
  isPending,
  organizationId,
  submitForm,
}: {
  isPending: boolean;
  organizationId: string;
  submitForm: SubmitWebsiteForm;
}) {
  return (
    <form
      className="form-grid compact"
      action={(formData) => submitForm(createPage, formData, 'page-create')}
    >
      <input type="hidden" name="organizationId" value={organizationId} />
      <label>
        Slug
        <input name="slug" required maxLength={80} placeholder="about" />
      </label>
      <label>
        Title
        <input name="title" required maxLength={160} placeholder="About us" />
      </label>
      <FormSelect label="Status" name="status" defaultValue="DRAFT">
        {PAGE_STATUSES.map((status) => (
          <option key={status} value={status}>
            {status}
          </option>
        ))}
      </FormSelect>
      <input type="hidden" name="seoTitle" />
      <input type="hidden" name="seoDescription" />
      <Button type="submit" disabled={isPending}>
        {isPending ? 'Saving...' : 'Create page'}
      </Button>
    </form>
  );
}

function PageEditor({
  organizationId,
  page,
  pendingKey,
  slug,
  submitForm,
}: {
  organizationId: string;
  page: DashboardPage;
  pendingKey: string | null;
  slug: string;
  submitForm: SubmitWebsiteForm;
}) {
  const sectionIds = page.sections.map((section) => section.id).join(',');

  return (
    <article className="form-grid max-w-none min-w-0 content-start">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="m-0">{page.title}</h3>
          <p className="m-0 text-sm text-[var(--muted)]">
            /o/{slug}/{page.slug}
          </p>
        </div>
        <div className="actions">
          <StatusBadge status={page.status} />
          <form
            action={(formData) =>
              submitForm(setPagePublished, formData, `page:${page.id}:published`)
            }
          >
            <input type="hidden" name="organizationId" value={organizationId} />
            <input type="hidden" name="pageId" value={page.id} />
            <input type="hidden" name="published" value={page.publishedAt ? 'false' : 'true'} />
            <Button
              type="submit"
              variant="secondary"
              disabled={pendingKey === `page:${page.id}:published`}
            >
              {pendingKey === `page:${page.id}:published`
                ? 'Saving...'
                : page.publishedAt
                  ? 'Unpublish'
                  : 'Publish'}
            </Button>
          </form>
        </div>
      </div>

      <form
        className="grid gap-3"
        action={(formData) => submitForm(updatePage, formData, `page:${page.id}:update`)}
      >
        <input type="hidden" name="organizationId" value={organizationId} />
        <input type="hidden" name="pageId" value={page.id} />
        <div className="grid gap-3 sm:grid-cols-3">
          <label>
            Slug
            <input name="slug" required maxLength={80} defaultValue={page.slug} />
          </label>
          <label>
            Title
            <input name="title" required maxLength={160} defaultValue={page.title} />
          </label>
          <FormSelect label="Status" name="status" defaultValue={page.status}>
            {PAGE_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </FormSelect>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label>
            SEO title
            <input name="seoTitle" maxLength={160} defaultValue={readString(page.seo, 'title')} />
          </label>
          <label>
            SEO description
            <input
              name="seoDescription"
              maxLength={500}
              defaultValue={readString(page.seo, 'description')}
            />
          </label>
        </div>
        <Button
          className="md:max-w-1/3"
          type="submit"
          disabled={pendingKey === `page:${page.id}:update`}
        >
          {pendingKey === `page:${page.id}:update` ? 'Saving...' : 'Save page'}
        </Button>
      </form>

      <SectionsEditor
        organizationId={organizationId}
        page={page}
        pendingKey={pendingKey}
        sectionIds={sectionIds}
        submitForm={submitForm}
      />
    </article>
  );
}

function SectionsEditor({
  organizationId,
  page,
  pendingKey,
  sectionIds,
  submitForm,
}: {
  organizationId: string;
  page: DashboardPage;
  pendingKey: string | null;
  sectionIds: string;
  submitForm: SubmitWebsiteForm;
}) {
  return (
    <div className="grid min-w-0 content-start gap-3">
      <h4 className="m-0">Sections</h4>
      <CreateSectionForm
        isPending={pendingKey === `page:${page.id}:section-create`}
        organizationId={organizationId}
        page={page}
        submitForm={submitForm}
      />
      {page.sections.map((section, index) => (
        <SectionEditor
          index={index}
          key={sectionEditorKey(section)}
          organizationId={organizationId}
          page={page}
          pendingKey={pendingKey}
          section={section}
          sectionIds={sectionIds}
          submitForm={submitForm}
        />
      ))}
    </div>
  );
}

function CreateSectionForm({
  isPending,
  organizationId,
  page,
  submitForm,
}: {
  isPending: boolean;
  organizationId: string;
  page: DashboardPage;
  submitForm: SubmitWebsiteForm;
}) {
  return (
    <form
      className="grid gap-3 sm:grid-cols-[repeat(3,minmax(0,1fr))_auto]"
      action={(formData) => submitForm(createSection, formData, `page:${page.id}:section-create`)}
    >
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="pageId" value={page.id} />
      <input type="hidden" name="order" value={page.sections.length} />
      <SectionPresetSelect defaultValue="hero" />
      <label>
        Title/headline
        <input name="title" placeholder="Welcome" />
      </label>
      <label>
        Body/subheading
        <input name="body" placeholder="Short content" />
      </label>
      <input type="hidden" name="items" />
      <Button type="submit" disabled={isPending} className="min-h-10.5 self-end">
        {isPending ? 'Saving...' : 'Add section'}
      </Button>
    </form>
  );
}

function SectionEditor({
  index,
  organizationId,
  page,
  pendingKey,
  section,
  sectionIds,
  submitForm,
}: {
  index: number;
  organizationId: string;
  page: DashboardPage;
  pendingKey: string | null;
  section: DashboardSection;
  sectionIds: string;
  submitForm: SubmitWebsiteForm;
}) {
  const initialPresetValue = sectionPresetValue(section);
  const [selectedPresetValue, setSelectedPresetValue] = useState<string>(initialPresetValue);
  const selectedPreset = sectionPreset(selectedPresetValue);
  const selectedPresetFields: readonly SectionFieldGroup[] = selectedPreset.fields;
  const hasField = (field: SectionFieldGroup) => selectedPresetFields.includes(field);

  return (
    <section className="grid min-w-0 content-start gap-3 rounded-md border border-[var(--line)] bg-[var(--surface-subtle)] p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <strong>{section.type}</strong>
        <SectionActions
          index={index}
          organizationId={organizationId}
          page={page}
          pendingKey={pendingKey}
          section={section}
          sectionIds={sectionIds}
          submitForm={submitForm}
        />
      </div>
      <form
        className="grid gap-3"
        action={(formData) => submitForm(updateSection, formData, `section:${section.id}:update`)}
      >
        <input type="hidden" name="organizationId" value={organizationId} />
        <input type="hidden" name="sectionId" value={section.id} />
        <input type="hidden" name="order" value={section.order} />
        <div className="grid gap-3 sm:grid-cols-2">
          {hasField('preset') ? (
            <SectionPresetSelect
              defaultValue={selectedPresetValue}
              onChange={(value) => setSelectedPresetValue(value)}
            />
          ) : null}
          {hasField('font') ? (
            <SectionFontSelect
              defaultValue={readString(section.content, 'fontPreset', 'default')}
            />
          ) : null}
        </div>
        {hasField('titleBody') ? <TitleBodyFields section={section} /> : null}
        {hasField('contact') ? <ContactFields section={section} /> : null}
        {hasField('buttons') ? <ButtonFields section={section} /> : null}
        {hasField('items') ? <ItemsField section={section} /> : null}
        {hasField('copyright') ? <CopyrightField section={section} /> : null}
        {hasField('background') ? <BackgroundFields section={section} /> : null}
        <Button
          type="submit"
          variant="secondary"
          disabled={pendingKey === `section:${section.id}:update`}
        >
          {pendingKey === `section:${section.id}:update` ? 'Saving...' : 'Save section'}
        </Button>
      </form>
    </section>
  );
}

function SectionActions({
  index,
  organizationId,
  page,
  pendingKey,
  section,
  sectionIds,
  submitForm,
}: {
  index: number;
  organizationId: string;
  page: DashboardPage;
  pendingKey: string | null;
  section: DashboardSection;
  sectionIds: string;
  submitForm: SubmitWebsiteForm;
}) {
  return (
    <div className="actions">
      <SectionMoveButton
        disabled={index === 0}
        fromIndex={index}
        label="Up"
        organizationId={organizationId}
        pageId={page.id}
        pendingKey={pendingKey}
        sectionIds={sectionIds}
        submitForm={submitForm}
        toIndex={Math.max(index - 1, 0)}
      />
      <SectionMoveButton
        disabled={index === page.sections.length - 1}
        fromIndex={index}
        label="Down"
        organizationId={organizationId}
        pageId={page.id}
        pendingKey={pendingKey}
        sectionIds={sectionIds}
        submitForm={submitForm}
        toIndex={Math.min(index + 1, page.sections.length - 1)}
      />
      <form
        action={(formData) => submitForm(deleteSection, formData, `section:${section.id}:delete`)}
      >
        <input type="hidden" name="organizationId" value={organizationId} />
        <input type="hidden" name="sectionId" value={section.id} />
        <Button
          type="submit"
          variant="danger"
          disabled={pendingKey === `section:${section.id}:delete`}
        >
          {pendingKey === `section:${section.id}:delete` ? 'Saving...' : 'Delete'}
        </Button>
      </form>
    </div>
  );
}

function SectionMoveButton({
  disabled,
  fromIndex,
  label,
  organizationId,
  pageId,
  pendingKey,
  sectionIds,
  submitForm,
  toIndex,
}: {
  disabled: boolean;
  fromIndex: number;
  label: string;
  organizationId: string;
  pageId: string;
  pendingKey: string | null;
  sectionIds: string;
  submitForm: SubmitWebsiteForm;
  toIndex: number;
}) {
  const actionKey = `page:${pageId}:section-reorder`;

  return (
    <form action={(formData) => submitForm(reorderSections, formData, actionKey)}>
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="pageId" value={pageId} />
      <input type="hidden" name="sectionIds" value={sectionIds} />
      <input type="hidden" name="fromIndex" value={fromIndex} />
      <input type="hidden" name="toIndex" value={toIndex} />
      <Button type="submit" variant="secondary" disabled={disabled || pendingKey === actionKey}>
        {pendingKey === actionKey ? 'Saving...' : label}
      </Button>
    </form>
  );
}

function TitleBodyFields({ section }: { section: DashboardSection }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label>
        Title/headline
        <input
          name="title"
          defaultValue={
            readString(section.content, 'title') || readString(section.content, 'headline')
          }
        />
      </label>
      <label>
        Body/subheading
        <input
          name="body"
          defaultValue={
            readString(section.content, 'body') || readString(section.content, 'subheading')
          }
        />
      </label>
    </div>
  );
}

function ContactFields({ section }: { section: DashboardSection }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <label>
        Address
        <input name="address" defaultValue={readString(section.content, 'address')} />
      </label>
      <label>
        Email
        <input name="email" defaultValue={readString(section.content, 'email')} />
      </label>
      <label>
        Phone
        <input name="phone" defaultValue={readString(section.content, 'phone')} />
      </label>
    </div>
  );
}

function ButtonFields({ section }: { section: DashboardSection }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label>
        Primary button
        <input
          name="primaryLabel"
          placeholder="Button label"
          defaultValue={readString(section.content, 'primaryLabel')}
        />
      </label>
      <label>
        Primary URL
        <input
          name="primaryHref"
          placeholder="#section or https://..."
          defaultValue={readString(section.content, 'primaryHref')}
        />
      </label>
      <label>
        Secondary button
        <input
          name="secondaryLabel"
          placeholder="Button label"
          defaultValue={readString(section.content, 'secondaryLabel')}
        />
      </label>
      <label>
        Secondary URL
        <input
          name="secondaryHref"
          placeholder="#section or https://..."
          defaultValue={readString(section.content, 'secondaryHref')}
        />
      </label>
    </div>
  );
}

function ItemsField({ section }: { section: DashboardSection }) {
  return (
    <label>
      Cards or links
      <textarea
        name="items"
        rows={4}
        placeholder="Title | Description | Button label | URL"
        defaultValue={formatItems(section.content['items'])}
      />
    </label>
  );
}

function CopyrightField({ section }: { section: DashboardSection }) {
  return (
    <div className="grid gap-3">
      <label>
        Copyright/footer text
        <input name="copyright" defaultValue={readString(section.content, 'copyright')} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label>
          Meta URL
          <input
            name="socialMetaHref"
            placeholder="https://facebook.com/..."
            defaultValue={readString(section.content, 'socialMetaHref')}
          />
        </label>
        <label>
          Instagram URL
          <input
            name="socialInstagramHref"
            placeholder="https://instagram.com/..."
            defaultValue={readString(section.content, 'socialInstagramHref')}
          />
        </label>
        <label>
          TikTok URL
          <input
            name="socialTiktokHref"
            placeholder="https://tiktok.com/@..."
            defaultValue={readString(section.content, 'socialTiktokHref')}
          />
        </label>
        <label>
          X URL
          <input
            name="socialXHref"
            placeholder="https://x.com/..."
            defaultValue={readString(section.content, 'socialXHref')}
          />
        </label>
      </div>
    </div>
  );
}

function BackgroundFields({ section }: { section: DashboardSection }) {
  const backgroundImageAssetId = readString(section.content, 'backgroundImageAssetId');
  const backgroundImageUrl = readString(section.content, 'backgroundImageUrl');

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-3">
        <label>
          Section background color
          <input
            name="backgroundColor"
            placeholder="#f6f8fa"
            defaultValue={readString(section.content, 'backgroundColor')}
          />
        </label>
        <label>
          Section background image
          <input name="backgroundImageFile" accept="image/jpeg,image/png,image/webp" type="file" />
        </label>
        <Checkbox
          label="Remove background image"
          labelClassName="self-end"
          name="removeBackgroundImage"
          value="true"
          disabled={!backgroundImageAssetId}
        />
      </div>
      <input type="hidden" name="backgroundImageAssetId" value={backgroundImageAssetId} />
      <input type="hidden" name="backgroundImageUrl" value={backgroundImageUrl} />
      {backgroundImageUrl ? (
        <div
          className="aspect-square w-full max-w-72 rounded-md border border-[var(--line)] bg-[center/contain_no-repeat] bg-[var(--surface)]"
          style={{
            backgroundImage: `url(${backgroundImageUrl})`,
          }}
          aria-label="Current section background image preview"
        />
      ) : null}
    </>
  );
}

function SectionPresetSelect({
  defaultValue,
  onChange,
}: {
  defaultValue: string;
  onChange?: (value: string) => void;
}) {
  return (
    <FormSelect
      label="Section"
      name="preset"
      defaultValue={defaultValue}
      onChange={(event) => onChange?.(event.currentTarget.value)}
    >
      {SECTION_PRESETS.map((preset) => (
        <option key={preset.variant} value={preset.variant}>
          {preset.label}
        </option>
      ))}
    </FormSelect>
  );
}

function SectionFontSelect({ defaultValue }: { defaultValue: string }) {
  return (
    <FormSelect label="Font" name="fontPreset" defaultValue={defaultValue}>
      {SECTION_FONT_PRESETS.map((preset) => (
        <option key={preset.value} value={preset.value}>
          {preset.label}
        </option>
      ))}
    </FormSelect>
  );
}

function applyWebsiteMutation(
  result: Extract<WebsiteFormResult, { ok: true }>,
  setWebsite: (
    update: DashboardWebsite | ((website: DashboardWebsite) => DashboardWebsite),
  ) => void,
  setPages: (update: DashboardPage[] | ((pages: DashboardPage[]) => DashboardPage[])) => void,
) {
  const { mutation } = result;

  switch (mutation.type) {
    case 'website':
      setWebsite(mutation.website);
      return;
    case 'page':
    case 'page-created':
      setPages((pages) => upsertPage(pages, mutation.page));
      return;
    case 'section-created':
      setPages((pages) =>
        updatePageSections(pages, mutation.pageId, (sections) =>
          sortSections([...sections, mutation.section]),
        ),
      );
      return;
    case 'section-updated':
      setPages((pages) =>
        pages.map((page) => ({
          ...page,
          sections: page.sections.map((section) =>
            section.id === mutation.section.id ? mutation.section : section,
          ),
        })),
      );
      return;
    case 'section-deleted':
      setPages((pages) =>
        pages.map((page) => ({
          ...page,
          sections: page.sections.filter((section) => section.id !== mutation.sectionId),
        })),
      );
      return;
    case 'sections-reordered':
      setPages((pages) =>
        updatePageSections(pages, mutation.pageId, () => sortSections(mutation.sections)),
      );
      return;
    case 'starter-home':
      setPages((pages) => {
        if (mutation.page) {
          return upsertPage(pages, {
            ...mutation.page,
            sections: sortSections([...mutation.page.sections, ...mutation.sections]),
          });
        }

        return updatePageSections(pages, mutation.pageId, (sections) =>
          sortSections([...sections, ...mutation.sections]),
        );
      });
      return;
  }
}

function upsertPage(pages: DashboardPage[], nextPage: DashboardPage): DashboardPage[] {
  if (pages.some((page) => page.id === nextPage.id)) {
    return pages.map((page) => (page.id === nextPage.id ? nextPage : page));
  }

  return [nextPage, ...pages];
}

function updatePageSections(
  pages: DashboardPage[],
  pageId: string,
  updateSections: (sections: DashboardSection[]) => DashboardSection[],
): DashboardPage[] {
  return pages.map((page) =>
    page.id === pageId ? { ...page, sections: updateSections(page.sections) } : page,
  );
}

function sortSections(sections: DashboardSection[]): DashboardSection[] {
  return [...sections].sort((left, right) => left.order - right.order);
}

function pageEditorKey(page: DashboardPage): string {
  return [
    page.id,
    page.slug,
    page.title,
    page.status,
    page.publishedAt ?? '',
    page.sections.length,
  ].join(':');
}

function sectionEditorKey(section: DashboardSection): string {
  return [section.id, section.type, section.order, JSON.stringify(section.content)].join(':');
}

async function uploadSectionBackgroundImage(
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const file = formData.get('backgroundImageFile');
  formData.delete('backgroundImageFile');

  if (!(file instanceof File) || file.size === 0) {
    return { ok: true };
  }

  if (!allowedBackgroundImageTypes.has(file.type)) {
    return { ok: false, error: 'Choose a JPEG, PNG, or WebP background image.' };
  }

  if (file.size > maxBackgroundImageBytes) {
    return { ok: false, error: 'The background image must not exceed 5 MB.' };
  }

  const organizationId = String(formData.get('organizationId') ?? '');
  const prepared = await prepareWebsiteSectionBackgroundImageAction({
    organizationId,
    filename: file.name,
    mimeType: file.type,
    byteSize: file.size,
  });

  if (!prepared.ok) {
    return { ok: false, error: prepared.error };
  }

  const upload = await fetch(prepared.uploadUrl, {
    method: 'PUT',
    headers: { 'content-type': file.type },
    body: file,
  });

  if (!upload.ok) {
    return { ok: false, error: 'Background image upload failed.' };
  }

  const confirmed = await confirmWebsiteSectionBackgroundImageAction({
    organizationId,
    assetId: prepared.assetId,
  });

  if (!confirmed.ok) {
    return { ok: false, error: confirmed.error };
  }

  formData.set('backgroundImageAssetId', confirmed.assetId);
  formData.set('backgroundImageUrl', confirmed.imageUrl);
  formData.delete('removeBackgroundImage');

  return { ok: true };
}
