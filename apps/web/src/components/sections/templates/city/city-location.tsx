import { readText, type PublicWebsiteSummary } from '../../types';
import {
  CityButton,
  CityEyebrow,
  CityHeading,
  cityMessages,
  formatServiceTime,
  resolveWebsiteHref,
  type CityTheme,
} from './city-shared';

export function CityLocation({
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
  const locale = settings?.locale ?? 'en';
  const address = settings?.location?.address;
  const addressNote = settings?.location?.addressNote;
  const serviceTimes = settings?.serviceTimes ?? [];
  const directionsUrl = settings?.location?.directionsUrl;
  const imageUrl = readText(content, 'backgroundImageUrl');

  if (!address && serviceTimes.length === 0) return null;

  const primaryLabel = readText(content, 'primaryLabel');
  const secondaryLabel = readText(content, 'secondaryLabel');

  return (
    <section className="px-5 pb-14 lg:pb-[104px]" id="location">
      <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-8 lg:gap-12">
        <div className="flex flex-col gap-3">
          <CityEyebrow style={{ color: theme.accentInk }}>
            {readText(content, 'eyebrow')}
          </CityEyebrow>
          <CityHeading>{readText(content, 'title', messages.address)}</CityHeading>
        </div>
        <div className="grid border border-[#e5e5e5] lg:grid-cols-[7fr_5fr]">
          <div
            aria-hidden={imageUrl ? undefined : true}
            className="min-h-[220px] bg-[#e9e9e9] lg:min-h-[520px]"
            style={
              imageUrl
                ? {
                    backgroundImage: `url(${imageUrl})`,
                    backgroundPosition: 'center',
                    backgroundSize: 'cover',
                  }
                : undefined
            }
          />
          <div className="flex flex-col justify-between gap-8 p-6 lg:border-l lg:border-[#e5e5e5] lg:p-11">
            <div className="flex flex-col gap-7">
              {address ? (
                <div className="flex flex-col gap-2">
                  <CityEyebrow className="text-[#6b6b6b]">{messages.address}</CityEyebrow>
                  <p className="m-0 text-[20px] font-bold leading-[1.25] sm:text-[22px]">
                    {address}
                  </p>
                  {addressNote ? (
                    <p className="m-0 text-[14px] leading-[1.5] text-[#6b6b6b]">{addressNote}</p>
                  ) : null}
                </div>
              ) : null}
              {serviceTimes.length > 0 ? (
                <div className="flex flex-col">
                  <CityEyebrow className="pb-2 text-[#6b6b6b]">{messages.services}</CityEyebrow>
                  <dl className="m-0 flex flex-col border-b border-[#e5e5e5]">
                    {serviceTimes.map((service) => (
                      <div
                        className="flex items-baseline justify-between gap-4 border-t border-[#e5e5e5] py-3.5"
                        key={`${service.weekday}:${service.time}`}
                      >
                        <dt className="font-semibold">
                          {service.label ?? formatServiceTime(service, locale).split(' · ')[0]}
                        </dt>
                        <dd className="m-0 font-bold">
                          {service.label ? formatServiceTime(service, locale) : service.time}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ) : null}
            </div>
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
      </div>
    </section>
  );
}
