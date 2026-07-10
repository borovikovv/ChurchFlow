import { PUBLIC_SECTION_TYPES } from '@churchflow/shared';
import { Button, ButtonLink } from '@/components/ui/button';
import { FormSelect } from '@/components/forms/form-select';
import { PageHeader } from '@/components/ui/page-header';
import { StatusBadge } from '@/components/ui/status-badge';
import type { DashboardPage, DashboardSection, DashboardWebsite, WebsiteFeedback } from '../types';
import {
  createPage,
  createSection,
  deleteSection,
  reorderSections,
  setPagePublished,
  setWebsitePublished,
  updatePage,
  updateSection,
  updateSettings,
} from '../form-actions';
import { PAGE_STATUSES, readString } from '../website-form-utils';

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
  return (
    <main className="stack">
      <PageHeader
        title="Website"
        description="Publish and manage the public website for this organization."
        actions={
          <ButtonLink href={publicUrl} variant="secondary">
            Open public site
          </ButtonLink>
        }
      />

      <WebsiteFeedbackMessage feedback={feedback} />
      <WebsiteStatusPanel
        organizationId={organizationId}
        publicUrl={publicUrl}
        published={Boolean(website.publishedAt)}
      />
      <WebsiteSettingsForm organizationId={organizationId} website={website} />

      <section className="stack">
        <div>
          <h2>Pages</h2>
          <p className="m-0 text-sm text-[var(--muted)]">
            Published pages are visible on the public website. The home page uses slug home.
          </p>
        </div>

        <CreatePageForm organizationId={organizationId} />
        {pages.map((page) => (
          <PageEditor key={page.id} organizationId={organizationId} page={page} slug={slug} />
        ))}
      </section>
    </main>
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
  organizationId,
  publicUrl,
  published,
}: {
  organizationId: string;
  publicUrl: string;
  published: boolean;
}) {
  return (
    <section className="form-grid">
      <div className="actions">
        <StatusBadge status={published ? 'PUBLISHED' : 'DRAFT'} />
        <span className="text-sm text-[var(--muted)]">{publicUrl}</span>
      </div>
      <form className="actions" action={setWebsitePublished}>
        <input type="hidden" name="organizationId" value={organizationId} />
        <input type="hidden" name="published" value={published ? 'false' : 'true'} />
        <Button type="submit" variant={published ? 'secondary' : 'primary'}>
          {published ? 'Unpublish website' : 'Publish website'}
        </Button>
      </form>
    </section>
  );
}

function WebsiteSettingsForm({
  organizationId,
  website,
}: {
  organizationId: string;
  website: DashboardWebsite;
}) {
  return (
    <section className="form-grid">
      <h2 className="m-0">Website settings</h2>
      <form className="grid gap-3" action={updateSettings}>
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
        <Button type="submit">Save settings</Button>
      </form>
    </section>
  );
}

function CreatePageForm({ organizationId }: { organizationId: string }) {
  return (
    <form className="form-grid compact" action={createPage}>
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
      <Button type="submit">Create page</Button>
    </form>
  );
}

function PageEditor({
  organizationId,
  page,
  slug,
}: {
  organizationId: string;
  page: DashboardPage;
  slug: string;
}) {
  const sectionIds = page.sections.map((section) => section.id).join(',');

  return (
    <article className="form-grid max-w-none">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="m-0">{page.title}</h3>
          <p className="m-0 text-sm text-[var(--muted)]">
            /o/{slug}/{page.slug}
          </p>
        </div>
        <div className="actions">
          <StatusBadge status={page.status} />
          <form action={setPagePublished}>
            <input type="hidden" name="organizationId" value={organizationId} />
            <input type="hidden" name="pageId" value={page.id} />
            <input type="hidden" name="published" value={page.publishedAt ? 'false' : 'true'} />
            <Button type="submit" variant="secondary">
              {page.publishedAt ? 'Unpublish' : 'Publish'}
            </Button>
          </form>
        </div>
      </div>

      <form className="grid gap-3" action={updatePage}>
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
        <Button type="submit">Save page</Button>
      </form>

      <SectionsEditor organizationId={organizationId} page={page} sectionIds={sectionIds} />
    </article>
  );
}

function SectionsEditor({
  organizationId,
  page,
  sectionIds,
}: {
  organizationId: string;
  page: DashboardPage;
  sectionIds: string;
}) {
  return (
    <div className="grid gap-3">
      <h4 className="m-0">Sections</h4>
      <CreateSectionForm organizationId={organizationId} page={page} />
      {page.sections.map((section, index) => (
        <SectionEditor
          index={index}
          key={section.id}
          organizationId={organizationId}
          page={page}
          section={section}
          sectionIds={sectionIds}
        />
      ))}
    </div>
  );
}

function CreateSectionForm({
  organizationId,
  page,
}: {
  organizationId: string;
  page: DashboardPage;
}) {
  return (
    <form className="grid gap-3 sm:grid-cols-[repeat(3,minmax(0,1fr))_auto]" action={createSection}>
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="pageId" value={page.id} />
      <input type="hidden" name="order" value={page.sections.length} />
      <SectionTypeSelect defaultValue="hero" />
      <label>
        Title/headline
        <input name="title" placeholder="Welcome" />
      </label>
      <label>
        Body/subheading
        <input name="body" placeholder="Short content" />
      </label>
      <Button type="submit">Add section</Button>
    </form>
  );
}

function SectionEditor({
  index,
  organizationId,
  page,
  section,
  sectionIds,
}: {
  index: number;
  organizationId: string;
  page: DashboardPage;
  section: DashboardSection;
  sectionIds: string;
}) {
  return (
    <section className="grid gap-3 rounded-md border border-[var(--line)] bg-[var(--surface-subtle)] p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <strong>{section.type}</strong>
        <SectionActions
          index={index}
          organizationId={organizationId}
          page={page}
          section={section}
          sectionIds={sectionIds}
        />
      </div>
      <form className="grid gap-3" action={updateSection}>
        <input type="hidden" name="organizationId" value={organizationId} />
        <input type="hidden" name="sectionId" value={section.id} />
        <input type="hidden" name="order" value={section.order} />
        <div className="grid gap-3 sm:grid-cols-3">
          <SectionTypeSelect defaultValue={section.type} />
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
        <Button type="submit" variant="secondary">
          Save section
        </Button>
      </form>
    </section>
  );
}

function SectionActions({
  index,
  organizationId,
  page,
  section,
  sectionIds,
}: {
  index: number;
  organizationId: string;
  page: DashboardPage;
  section: DashboardSection;
  sectionIds: string;
}) {
  return (
    <div className="actions">
      <SectionMoveButton
        disabled={index === 0}
        fromIndex={index}
        label="Up"
        organizationId={organizationId}
        pageId={page.id}
        sectionIds={sectionIds}
        toIndex={Math.max(index - 1, 0)}
      />
      <SectionMoveButton
        disabled={index === page.sections.length - 1}
        fromIndex={index}
        label="Down"
        organizationId={organizationId}
        pageId={page.id}
        sectionIds={sectionIds}
        toIndex={Math.min(index + 1, page.sections.length - 1)}
      />
      <form action={deleteSection}>
        <input type="hidden" name="organizationId" value={organizationId} />
        <input type="hidden" name="sectionId" value={section.id} />
        <Button type="submit" variant="danger">
          Delete
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
  sectionIds,
  toIndex,
}: {
  disabled: boolean;
  fromIndex: number;
  label: string;
  organizationId: string;
  pageId: string;
  sectionIds: string;
  toIndex: number;
}) {
  return (
    <form action={reorderSections}>
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="pageId" value={pageId} />
      <input type="hidden" name="sectionIds" value={sectionIds} />
      <input type="hidden" name="fromIndex" value={fromIndex} />
      <input type="hidden" name="toIndex" value={toIndex} />
      <Button type="submit" variant="secondary" disabled={disabled}>
        {label}
      </Button>
    </form>
  );
}

function SectionTypeSelect({ defaultValue }: { defaultValue: DashboardSection['type'] }) {
  return (
    <FormSelect label="Type" name="type" defaultValue={defaultValue}>
      {PUBLIC_SECTION_TYPES.map((type) => (
        <option key={type} value={type}>
          {type}
        </option>
      ))}
    </FormSelect>
  );
}
