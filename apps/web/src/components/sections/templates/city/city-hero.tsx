import { readText, type PublicWebsiteSummary } from '../../types';
import { CityHeader } from './city-header';
import {
  CITY_COVER_CLASS,
  CITY_IMAGE_PLATE_CLASS,
  CityBackgroundImage,
  CityButtons,
  CityEyebrow,
  CityHeading,
  cityMessages,
  formatNextService,
  type CityTheme,
} from './city-shared';

interface CityHeroProps {
  content: Record<string, unknown>;
  theme: CityTheme;
  website: PublicWebsiteSummary | undefined;
}

export function CityHero(props: CityHeroProps) {
  return readText(props.content, 'variant') === 'split' ? (
    <CityHeroSplit {...props} />
  ) : (
    <CityHeroCover {...props} />
  );
}

function CityHeroCover({ content, theme, website }: CityHeroProps) {
  const messages = cityMessages(website);
  const nextService = website?.settings?.live?.nextService ?? null;
  const eyebrow = heroEyebrow(content, website);
  const headline = readText(content, 'headline', website?.title ?? '');
  const subheading = readText(content, 'subheading', website?.description ?? '');

  return (
    <section
      className={`flex min-h-[640px] flex-col text-white lg:min-h-[840px] ${CITY_COVER_CLASS}`}
    >
      <CityBackgroundImage content={content} overlay priority sizes="100vw" />
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

// The photo keeps its own half of the screen and the text sits on white, so the dark menu bar runs
// above both halves instead of over the image.
function CityHeroSplit({ content, theme, website }: CityHeroProps) {
  const eyebrow = heroEyebrow(content, website);
  const headline = readText(content, 'headline', website?.title ?? '');
  const subheading = readText(content, 'subheading', website?.description ?? '');
  const imageUrl = readText(content, 'backgroundImageUrl');

  return (
    <section className="bg-white text-[#0a0a0a]">
      <CityHeader standalone website={website} />
      <div className="grid lg:grid-cols-2">
        <div
          aria-hidden={imageUrl ? undefined : true}
          className={`order-1 min-h-[260px] sm:min-h-[360px] lg:order-2 lg:min-h-[620px] ${CITY_IMAGE_PLATE_CLASS}`}
        >
          <CityBackgroundImage content={content} priority sizes="(min-width: 1024px) 50vw, 100vw" />
        </div>
        <div className="order-2 flex flex-col justify-center gap-5 px-5 py-12 sm:gap-7 lg:order-1 lg:px-12 lg:py-[88px]">
          {eyebrow ? <CityEyebrow style={{ color: theme.accentInk }}>{eyebrow}</CityEyebrow> : null}
          <h1 className="m-0 max-w-[560px] text-[36px] font-black uppercase leading-[1.02] tracking-[-0.02em] text-balance sm:text-[52px]">
            {headline}
          </h1>
          {subheading ? (
            <p className="m-0 max-w-[520px] text-[16px] leading-[1.7] text-[#3d3d3d] sm:text-[18px]">
              {subheading}
            </p>
          ) : null}
          <CityButtons content={content} onDark={false} theme={theme} website={website} />
        </div>
      </div>
    </section>
  );
}

function heroEyebrow(
  content: Record<string, unknown>,
  website: PublicWebsiteSummary | undefined,
): string {
  const nextService = website?.settings?.live?.nextService ?? null;
  const address = website?.settings?.location?.address;

  return (
    readText(content, 'eyebrow') ||
    [nextService ? formatNextService(nextService, website) : '', address ?? '']
      .filter(Boolean)
      .join(' · ')
  );
}
