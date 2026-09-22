import { readText, type PublicWebsiteSummary } from '../../types';
import {
  CITY_COVER_CLASS,
  CityBackgroundImage,
  CityButtons,
  CityEyebrow,
  CityHeading,
  type CityTheme,
} from './city-shared';

interface GivingWay {
  label: string;
  value: string;
}

interface CityGivingProps {
  content: Record<string, unknown>;
  theme: CityTheme;
  website: PublicWebsiteSummary | undefined;
}

export function CityGiving(props: CityGivingProps) {
  const { content } = props;
  const ways = readWays(content);

  if (
    !readText(content, 'title') &&
    !readText(content, 'body') &&
    !readText(content, 'primaryLabel') &&
    ways.length === 0
  ) {
    return null;
  }

  return readText(content, 'variant') === 'ways' ? (
    <CityGivingWays {...props} ways={ways} />
  ) : (
    <CityGivingCover {...props} ways={ways} />
  );
}

function CityGivingCover({
  content,
  theme,
  ways,
  website,
}: CityGivingProps & { ways: GivingWay[] }) {
  const title = readText(content, 'title');
  const body = readText(content, 'body');

  return (
    <section
      className={`flex flex-col justify-between text-white lg:min-h-[640px] ${CITY_COVER_CLASS}`}
      id="giving"
    >
      <CityBackgroundImage content={content} overlay sizes="100vw" />
      <div className="mx-auto flex w-full max-w-[1240px] flex-col justify-between gap-10 px-5 py-14 lg:py-[88px]">
        <div className="flex max-w-[720px] flex-col gap-5 sm:gap-6">
          <CityEyebrow className="text-white/70">{readText(content, 'eyebrow')}</CityEyebrow>
          {title ? (
            <CityHeading className="text-white text-balance sm:text-[64px]">{title}</CityHeading>
          ) : null}
          {body ? (
            <p className="m-0 max-w-[560px] text-[16px] leading-[1.6] text-white/85 sm:text-[18px]">
              {body}
            </p>
          ) : null}
          <CityButtons content={content} onDark theme={theme} website={website} />
        </div>
        {ways.length > 0 ? (
          <dl className="m-0 grid border-t border-white/25 sm:grid-cols-3">
            {ways.map((way, index) => (
              <div
                className={`flex flex-col gap-1 py-4 sm:py-5 ${index > 0 ? 'border-t border-white/25 sm:border-l sm:border-t-0 sm:pl-6' : ''}`}
                key={way.label}
              >
                <dt className="text-[12px] font-bold uppercase tracking-[0.2em] text-white/60">
                  {way.label}
                </dt>
                <dd className="m-0 text-[15px] font-semibold">{way.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
    </section>
  );
}

// The light variant makes the ways themselves the section: large cards first, copy above them.
function CityGivingWays({
  content,
  theme,
  ways,
  website,
}: CityGivingProps & { ways: GivingWay[] }) {
  const title = readText(content, 'title');
  const body = readText(content, 'body');

  return (
    <section className="px-5 py-14 text-[#0a0a0a] lg:py-[104px]" id="giving">
      <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-8 lg:gap-12">
        <div className="flex max-w-[720px] flex-col gap-4 sm:gap-5">
          <CityEyebrow style={{ color: theme.accentInk }}>
            {readText(content, 'eyebrow')}
          </CityEyebrow>
          {title ? <CityHeading className="text-balance">{title}</CityHeading> : null}
          {body ? (
            <p className="m-0 max-w-[560px] text-[16px] leading-[1.7] text-[#3d3d3d] sm:text-[18px]">
              {body}
            </p>
          ) : null}
        </div>
        {ways.length > 0 ? (
          <dl className="m-0 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ways.map((way) => (
              <div
                className="flex flex-col gap-3 border border-[#e5e5e5] p-6 lg:p-8"
                key={way.label}
              >
                <dt className="text-[12px] font-bold uppercase tracking-[0.2em] text-[#6b6b6b]">
                  {way.label}
                </dt>
                <dd className="m-0 text-[18px] font-bold leading-[1.35] sm:text-[20px]">
                  {way.value}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}
        <CityButtons content={content} onDark={false} theme={theme} website={website} />
      </div>
    </section>
  );
}

function readWays(content: Record<string, unknown>): GivingWay[] {
  const value = content['ways'];
  if (!Array.isArray(value)) return [];

  return value.flatMap((way) => {
    if (typeof way !== 'object' || way === null) return [];
    const record = way as Record<string, unknown>;
    const label = typeof record['label'] === 'string' ? record['label'] : '';
    const text = typeof record['value'] === 'string' ? record['value'] : '';

    return label && text ? [{ label, value: text }] : [];
  });
}
