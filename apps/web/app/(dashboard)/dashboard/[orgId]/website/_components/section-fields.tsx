'use client';

import { useTranslations } from 'next-intl';
import type { WebsiteTemplateId } from '@churchflow/shared';
import { Checkbox } from '@/components/ui/checkbox';
import { FormRepeater, type RepeaterField } from '@/components/forms/form-repeater';
import { FormSelect } from '@/components/forms/form-select';
import type { DashboardSection } from '../types';
import {
  FOOTER_LINK_ROW_NAMES,
  GIVING_WAY_ROW_NAMES,
  SECTION_ITEM_ROW_NAMES,
  inertSectionRows,
  inertSectionText,
  itemRows,
  linkRows,
  readString,
  wayRows,
} from '../website-form-utils';
import { SECTION_FONT_PRESETS, type SectionFieldGroup } from '../website-section-presets';
import { templateReadsStyleControl } from '../website-template-fields';

// The limits the section content schemas put on each list.
const MAX_ITEMS = 24;
const MAX_GIVING_WAYS = 6;
const MAX_FOOTER_LINKS = 12;

export function SectionFields({
  fields,
  section,
  template,
}: {
  fields: readonly SectionFieldGroup[];
  section: DashboardSection;
  template: WebsiteTemplateId;
}) {
  const has = (field: SectionFieldGroup) => fields.includes(field);
  const showFontPreset = templateReadsStyleControl(template, 'sectionFontPreset');
  const showBackgroundColor = templateReadsStyleControl(template, 'sectionBackgroundColor');
  const hiddenControlKeys = [
    ...(showFontPreset ? [] : ['fontPreset']),
    ...(showBackgroundColor ? [] : ['backgroundColor']),
  ];

  return (
    <>
      {has('font') && showFontPreset ? <FontField section={section} /> : null}
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
      {has('background') ? (
        <BackgroundFields section={section} showColor={showBackgroundColor} />
      ) : null}
      <StoredSectionValues entries={inertSectionText(section.content, fields, hiddenControlKeys)} />
      <StoredSectionRows groups={inertSectionRows(section.content, fields)} />
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

// A value the active template never reads has no control, but the section keeps it: the form carries
// the stored value so switching back to a template that reads it finds it unchanged.
function StoredSectionValues({ entries }: { entries: Array<{ key: string; value: string }> }) {
  return (
    <>
      {entries.map((entry) => (
        <input key={entry.key} name={entry.key} type="hidden" value={entry.value} />
      ))}
    </>
  );
}

// A list the inspector offers no editor for keeps its rows the same way, one hidden input per stored
// row and column, so the parallel lists a save reads a row back from arrive complete.
function StoredSectionRows({ groups }: { groups: Array<{ name: string; values: string[] }> }) {
  return (
    <>
      {groups.map((group) =>
        group.values.map((value, index) => (
          <input key={`${group.name}:${index}`} name={group.name} type="hidden" value={value} />
        )),
      )}
    </>
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
  const fields: RepeaterField[] = [
    {
      kind: 'text',
      key: 'title',
      label: t('fields.itemTitle'),
      maxLength: 160,
      name: SECTION_ITEM_ROW_NAMES.title,
      required: true,
    },
    {
      kind: 'textarea',
      key: 'body',
      label: t('fields.itemBody'),
      maxLength: 600,
      name: SECTION_ITEM_ROW_NAMES.body,
    },
    // The city variants that offer this list render only a card's title and body, so neither the
    // label nor the link is offered. The classic card grid does render both, but it is never given
    // this editor. The stored values travel with their row so a save leaves them untouched.
    { kind: 'hidden', key: 'label', name: SECTION_ITEM_ROW_NAMES.label },
    { kind: 'hidden', key: 'href', name: SECTION_ITEM_ROW_NAMES.href },
  ];

  return (
    <FormRepeater
      addLabel={t('fields.addItem')}
      fields={fields}
      label={t('cardsOrLinks')}
      maxRows={MAX_ITEMS}
      rows={itemRows(section.content['items'])}
    />
  );
}

function WaysField({ section }: { section: DashboardSection }) {
  const t = useTranslations('website');
  const fields: RepeaterField[] = [
    {
      kind: 'text',
      key: 'label',
      label: t('fields.wayLabel'),
      maxLength: 80,
      name: GIVING_WAY_ROW_NAMES.label,
      required: true,
    },
    {
      kind: 'text',
      key: 'value',
      label: t('fields.wayValue'),
      maxLength: 300,
      name: GIVING_WAY_ROW_NAMES.value,
      required: true,
    },
  ];

  return (
    <FormRepeater
      addLabel={t('fields.addWay')}
      fields={fields}
      label={t('fields.givingWays')}
      maxRows={MAX_GIVING_WAYS}
      rows={wayRows(section.content['ways'])}
    />
  );
}

function LinksField({ section }: { section: DashboardSection }) {
  const t = useTranslations('website');
  const fields: RepeaterField[] = [
    {
      kind: 'text',
      key: 'label',
      label: t('fields.linkLabel'),
      maxLength: 80,
      name: FOOTER_LINK_ROW_NAMES.label,
      required: true,
    },
    {
      kind: 'text',
      key: 'href',
      label: t('fields.linkUrl'),
      name: FOOTER_LINK_ROW_NAMES.href,
      placeholder: t('fields.hrefPlaceholder'),
      required: true,
    },
  ];

  return (
    <FormRepeater
      addLabel={t('fields.addLink')}
      fields={fields}
      hint={t('fields.footerLinksHint')}
      label={t('fields.footerLinks')}
      maxRows={MAX_FOOTER_LINKS}
      rows={linkRows(section.content['links'])}
    />
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

function BackgroundFields({
  section,
  showColor,
}: {
  section: DashboardSection;
  showColor: boolean;
}) {
  const t = useTranslations('website');
  const backgroundImageAssetId = readString(section.content, 'backgroundImageAssetId');
  const backgroundImageUrl = readString(section.content, 'backgroundImageUrl');

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        {showColor ? (
          <label>
            {t('sectionBackgroundColor')}
            <input
              name="backgroundColor"
              placeholder="#f6f8fa"
              defaultValue={readString(section.content, 'backgroundColor')}
            />
          </label>
        ) : null}
        <label>
          {t('sectionBackgroundImage')}
          <input name="backgroundImageFile" accept="image/jpeg,image/png,image/webp" type="file" />
        </label>
      </div>
      <input type="hidden" name="backgroundImageAssetId" value={backgroundImageAssetId} />
      <input type="hidden" name="backgroundImageUrl" value={backgroundImageUrl} />
      {/* The description belongs to a stored image, so it is only offered once one exists. */}
      {backgroundImageUrl ? (
        <div className="grid gap-2">
          <label>
            {t('sectionBackgroundImageAlt')}
            <input
              name="backgroundImageAlt"
              maxLength={200}
              defaultValue={readString(section.content, 'backgroundImageAlt')}
            />
            <small>{t('sectionBackgroundImageAltHint')}</small>
          </label>
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
