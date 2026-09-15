'use client';

import { useTranslations } from 'next-intl';
import { Checkbox } from '@/components/ui/checkbox';
import { FormSelect } from '@/components/forms/form-select';
import type { DashboardSection } from '../types';
import { formatItems, formatLinks, formatWays, readString } from '../website-form-utils';
import { SECTION_FONT_PRESETS, type SectionFieldGroup } from '../website-section-presets';

// One form fragment per field group; the inspector composes them from the section's definition.
export function SectionFields({
  fields,
  section,
}: {
  fields: readonly SectionFieldGroup[];
  section: DashboardSection;
}) {
  const has = (field: SectionFieldGroup) => fields.includes(field);

  return (
    <>
      {has('font') ? <FontField section={section} /> : null}
      {has('eyebrow') ? <EyebrowField section={section} /> : null}
      {has('titleBody') ? <TitleBodyFields section={section} /> : null}
      {has('live') ? <LiveFields section={section} /> : null}
      {has('contact') ? <ContactFields section={section} /> : null}
      {has('buttons') ? <ButtonFields section={section} /> : null}
      {has('items') ? <ItemsField section={section} /> : null}
      {has('ways') ? <WaysField section={section} /> : null}
      {has('links') ? <LinksField section={section} /> : null}
      {has('copyright') ? <CopyrightField section={section} /> : null}
      {has('socials') ? <SocialFields section={section} /> : null}
      {has('background') ? <BackgroundFields section={section} /> : null}
    </>
  );
}

function FontField({ section }: { section: DashboardSection }) {
  const t = useTranslations('website');

  return (
    <FormSelect
      label={t('font')}
      name="fontPreset"
      defaultValue={readString(section.content, 'fontPreset', 'default')}
    >
      {SECTION_FONT_PRESETS.map((preset) => (
        <option key={preset.value} value={preset.value}>
          {t(`fonts.${preset.value}`)}
        </option>
      ))}
    </FormSelect>
  );
}

function EyebrowField({ section }: { section: DashboardSection }) {
  const t = useTranslations('website');

  return (
    <label>
      {t('fields.eyebrow')}
      <input
        name="eyebrow"
        maxLength={120}
        placeholder={t('fields.eyebrowPlaceholder')}
        defaultValue={readString(section.content, 'eyebrow')}
      />
    </label>
  );
}

function TitleBodyFields({ section }: { section: DashboardSection }) {
  const t = useTranslations('website');

  return (
    <>
      <label>
        {t('titleHeadline')}
        <input
          name="title"
          maxLength={200}
          defaultValue={
            readString(section.content, 'title') || readString(section.content, 'headline')
          }
        />
      </label>
      <label>
        {t('bodySubheading')}
        <textarea
          name="body"
          rows={3}
          maxLength={4000}
          defaultValue={
            readString(section.content, 'body') || readString(section.content, 'subheading')
          }
        />
      </label>
    </>
  );
}

function LiveFields({ section }: { section: DashboardSection }) {
  const t = useTranslations('website');

  return (
    <>
      <p className="m-0 text-sm text-[var(--muted)]">{t('fields.liveHint')}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label>
          {t('fields.liveLabel')}
          <input
            name="liveLabel"
            maxLength={80}
            defaultValue={readString(section.content, 'liveLabel')}
          />
        </label>
        <label>
          {t('fields.liveTitle')}
          <input
            name="liveTitle"
            maxLength={200}
            defaultValue={readString(section.content, 'liveTitle')}
          />
        </label>
      </div>
      <label>
        {t('fields.scheduledTitle')}
        <input
          name="scheduledTitle"
          maxLength={200}
          defaultValue={readString(section.content, 'scheduledTitle')}
        />
      </label>
      <label>
        {t('fields.scheduledBody')}
        <input
          name="scheduledBody"
          maxLength={600}
          defaultValue={readString(section.content, 'scheduledBody')}
        />
      </label>
    </>
  );
}

function ContactFields({ section }: { section: DashboardSection }) {
  const t = useTranslations('website');

  return (
    <>
      <label>
        {t('address')}
        <input
          name="address"
          maxLength={300}
          defaultValue={readString(section.content, 'address')}
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label>
          Email
          <input name="email" maxLength={160} defaultValue={readString(section.content, 'email')} />
        </label>
        <label>
          {t('phone')}
          <input name="phone" maxLength={60} defaultValue={readString(section.content, 'phone')} />
        </label>
      </div>
    </>
  );
}

function ButtonFields({ section }: { section: DashboardSection }) {
  const t = useTranslations('website');

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <label>
          {t('primaryButton')}
          <input
            name="primaryLabel"
            maxLength={80}
            placeholder={t('buttonLabel')}
            defaultValue={readString(section.content, 'primaryLabel')}
          />
        </label>
        <label>
          {t('primaryUrl')}
          <input
            name="primaryHref"
            placeholder={t('sectionOrUrl')}
            defaultValue={readString(section.content, 'primaryHref')}
          />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label>
          {t('secondaryButton')}
          <input
            name="secondaryLabel"
            maxLength={80}
            placeholder={t('buttonLabel')}
            defaultValue={readString(section.content, 'secondaryLabel')}
          />
        </label>
        <label>
          {t('secondaryUrl')}
          <input
            name="secondaryHref"
            placeholder={t('sectionOrUrl')}
            defaultValue={readString(section.content, 'secondaryHref')}
          />
        </label>
      </div>
    </>
  );
}

function ItemsField({ section }: { section: DashboardSection }) {
  const t = useTranslations('website');

  return (
    <label>
      {t('cardsOrLinks')}
      <textarea
        name="items"
        rows={4}
        placeholder={t('itemsPlaceholder')}
        defaultValue={formatItems(section.content['items'])}
      />
    </label>
  );
}

function WaysField({ section }: { section: DashboardSection }) {
  const t = useTranslations('website');

  return (
    <label>
      {t('fields.givingWays')}
      <textarea
        name="ways"
        rows={3}
        placeholder={t('fields.givingWaysPlaceholder')}
        defaultValue={formatWays(section.content['ways'])}
      />
    </label>
  );
}

function LinksField({ section }: { section: DashboardSection }) {
  const t = useTranslations('website');

  return (
    <label>
      {t('fields.footerLinks')}
      <textarea
        name="links"
        rows={3}
        placeholder={t('fields.linksPlaceholder')}
        defaultValue={formatLinks(section.content['links'])}
      />
      <span className="text-xs text-[var(--muted)]">{t('fields.footerLinksHint')}</span>
    </label>
  );
}

function CopyrightField({ section }: { section: DashboardSection }) {
  const t = useTranslations('website');

  return (
    <label>
      {t('copyrightFooterText')}
      <input
        name="copyright"
        maxLength={200}
        defaultValue={readString(section.content, 'copyright')}
      />
    </label>
  );
}

function SocialFields({ section }: { section: DashboardSection }) {
  const t = useTranslations('website');

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label>
        {t('metaUrl')}
        <input
          name="socialMetaHref"
          placeholder="https://facebook.com/..."
          defaultValue={readString(section.content, 'socialMetaHref')}
        />
      </label>
      <label>
        {t('instagramUrl')}
        <input
          name="socialInstagramHref"
          placeholder="https://instagram.com/..."
          defaultValue={readString(section.content, 'socialInstagramHref')}
        />
      </label>
      <label>
        {t('tiktokUrl')}
        <input
          name="socialTiktokHref"
          placeholder="https://tiktok.com/@..."
          defaultValue={readString(section.content, 'socialTiktokHref')}
        />
      </label>
      <label>
        {t('xUrl')}
        <input
          name="socialXHref"
          placeholder="https://x.com/..."
          defaultValue={readString(section.content, 'socialXHref')}
        />
      </label>
    </div>
  );
}

function BackgroundFields({ section }: { section: DashboardSection }) {
  const t = useTranslations('website');
  const backgroundImageAssetId = readString(section.content, 'backgroundImageAssetId');
  const backgroundImageUrl = readString(section.content, 'backgroundImageUrl');

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <label>
          {t('sectionBackgroundColor')}
          <input
            name="backgroundColor"
            placeholder="#f6f8fa"
            defaultValue={readString(section.content, 'backgroundColor')}
          />
        </label>
        <label>
          {t('sectionBackgroundImage')}
          <input name="backgroundImageFile" accept="image/jpeg,image/png,image/webp" type="file" />
        </label>
      </div>
      <input type="hidden" name="backgroundImageAssetId" value={backgroundImageAssetId} />
      <input type="hidden" name="backgroundImageUrl" value={backgroundImageUrl} />
      {backgroundImageUrl ? (
        <div className="grid gap-2">
          <div
            className="aspect-video w-full rounded-md border border-[var(--line)] bg-[center/cover_no-repeat] bg-[var(--surface)]"
            style={{ backgroundImage: `url(${backgroundImageUrl})` }}
            aria-label={t('backgroundPreview')}
          />
          <Checkbox label={t('removeBackgroundImage')} name="removeBackgroundImage" value="true" />
        </div>
      ) : null}
    </>
  );
}
