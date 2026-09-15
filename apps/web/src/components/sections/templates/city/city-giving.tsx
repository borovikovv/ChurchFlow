import { readText, type PublicWebsiteSummary } from '../../types';
import { CityButtons, CityEyebrow, CityHeading, coverStyle, type CityTheme } from './city-shared';

interface GivingWay {
  label: string;
  value: string;
}

export function CityGiving({
  content,
  theme,
  website,
}: {
  content: Record<string, unknown>;
  theme: CityTheme;
  website: PublicWebsiteSummary | undefined;
}) {
  const title = readText(content, 'title');
  const body = readText(content, 'body');
  const ways = readWays(content);

  if (!title && !body && !readText(content, 'primaryLabel')) return null;

  return (
    <section
      className="flex flex-col justify-between text-white lg:min-h-[640px]"
      id="giving"
      style={coverStyle(content)}
    >
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
