import { readText, type PublicWebsiteSummary } from '../../types';
import {
  CityButton,
  CityEyebrow,
  CityHeading,
  cityMessages,
  resolveWebsiteHref,
  type CityTheme,
} from './city-shared';

export function CityContact({
  content,
  theme,
  website,
}: {
  content: Record<string, unknown>;
  theme: CityTheme;
  website: PublicWebsiteSummary | undefined;
}) {
  const messages = cityMessages(website);
  const settings = website?.settings;
  const title = readText(content, 'title');
  const body = readText(content, 'body');
  // The section may carry its own details; otherwise the website settings answer for it.
  const address = readText(content, 'address') || settings?.location?.address || '';
  const addressNote = settings?.location?.addressNote;
  const email = readText(content, 'email');
  const phone = readText(content, 'phone');
  const directionsUrl = settings?.location?.directionsUrl;
  const eyebrow = readText(content, 'eyebrow');
  const primaryLabel = readText(content, 'primaryLabel');
  const secondaryLabel = readText(content, 'secondaryLabel');

  if (!title && !body && !address && !email && !phone) return null;

  return (
    <section className="px-5 py-14 lg:py-[104px]" id="contact">
      <div className="mx-auto grid w-full max-w-[1240px] gap-8 lg:grid-cols-2 lg:gap-16">
        <div className="flex flex-col gap-5 sm:gap-6">
          {eyebrow ? <CityEyebrow style={{ color: theme.accentInk }}>{eyebrow}</CityEyebrow> : null}
          <CityHeading className="text-balance">
            {readText(content, 'title', messages.contact)}
          </CityHeading>
          {body ? (
            <p className="m-0 max-w-[520px] text-[16px] leading-[1.7] text-[#3d3d3d] sm:text-[18px]">
              {body}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-8 border-t border-[#e5e5e5] pt-7 lg:border-l lg:border-t-0 lg:pl-12 lg:pt-0">
          <dl className="m-0 flex flex-col gap-6">
            {address ? (
              <div className="flex flex-col gap-2">
                <dt>
                  <CityEyebrow className="text-[#6b6b6b]">{messages.address}</CityEyebrow>
                </dt>
                <dd className="m-0 text-[20px] font-bold leading-[1.25] sm:text-[22px]">
                  {address}
                </dd>
                {addressNote ? (
                  <dd className="m-0 text-[14px] leading-[1.5] text-[#6b6b6b]">{addressNote}</dd>
                ) : null}
              </div>
            ) : null}
            {email ? (
              <div className="flex flex-col gap-2">
                <dt>
                  <CityEyebrow className="text-[#6b6b6b]">{messages.email}</CityEyebrow>
                </dt>
                <dd className="m-0 text-[18px] font-bold">
                  <a className="text-[#0a0a0a] hover:opacity-70" href={`mailto:${email}`}>
                    {email}
                  </a>
                </dd>
              </div>
            ) : null}
            {phone ? (
              <div className="flex flex-col gap-2">
                <dt>
                  <CityEyebrow className="text-[#6b6b6b]">{messages.phone}</CityEyebrow>
                </dt>
                <dd className="m-0 text-[18px] font-bold">
                  <a
                    className="text-[#0a0a0a] hover:opacity-70"
                    href={`tel:${phone.replace(/\s+/gu, '')}`}
                  >
                    {phone}
                  </a>
                </dd>
              </div>
            ) : null}
          </dl>
          {(primaryLabel && directionsUrl) || secondaryLabel ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              {primaryLabel && directionsUrl ? (
                <CityButton
                  href={directionsUrl}
                  style={{ background: theme.accentInk, color: theme.onAccentInk }}
                  tone="accent"
                >
                  {primaryLabel}
                </CityButton>
              ) : null}
              {secondaryLabel ? (
                <CityButton
                  href={resolveWebsiteHref(readText(content, 'secondaryHref'), website)}
                  tone="outline-dark"
                >
                  {secondaryLabel}
                </CityButton>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
