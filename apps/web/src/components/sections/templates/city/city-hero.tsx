import { readText, type PublicWebsiteSummary } from '../../types';
import { CityHeader } from './city-header';
import {
  CityButtons,
  CityEyebrow,
  CityHeading,
  cityMessages,
  coverStyle,
  formatNextService,
  type CityTheme,
} from './city-shared';

export function CityHero({
  content,
  theme,
  website,
}: {
  content: Record<string, unknown>;
  theme: CityTheme;
  website: PublicWebsiteSummary | undefined;
}) {
  const messages = cityMessages(website);
  const nextService = website?.settings?.live?.nextService ?? null;
  const address = website?.settings?.location?.address;
  const eyebrow =
    readText(content, 'eyebrow') ||
    [nextService ? formatNextService(nextService, website) : '', address ?? '']
      .filter(Boolean)
      .join(' · ');
  const headline = readText(content, 'headline', website?.title ?? '');
  const subheading = readText(content, 'subheading', website?.description ?? '');

  return (
    <section
      className="flex min-h-[640px] flex-col text-white lg:min-h-[840px]"
      style={coverStyle(content)}
    >
      <CityHeader website={website} />
      <div className="mx-auto flex w-full max-w-[1240px] flex-grow flex-col justify-end gap-5 px-5 pb-12 sm:gap-7 lg:items-center lg:justify-center lg:pb-[60px] lg:text-center">
        {eyebrow ? <CityEyebrow className="text-white/80">{eyebrow}</CityEyebrow> : null}
        <CityHeading className="max-w-[980px] text-white text-balance" level={1}>
          {headline}
        </CityHeading>
        {subheading ? (
          <p className="m-0 max-w-[560px] text-[16px] leading-[1.6] text-white/85 sm:text-[18px]">
            {subheading}
          </p>
        ) : null}
        <CityButtons content={content} onDark theme={theme} website={website} />
        {nextService && !readText(content, 'eyebrow') ? (
          <span className="sr-only">
            {messages.nextService}: {formatNextService(nextService, website)}
          </span>
        ) : null}
      </div>
    </section>
  );
}
