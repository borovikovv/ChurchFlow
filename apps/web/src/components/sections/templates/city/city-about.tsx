import { readText, type PublicWebsiteSummary } from '../../types';
import {
  CityButtons,
  CityEyebrow,
  CityHeading,
  coverStyle,
  readCityItems,
  type CityItem,
  type CityTheme,
} from './city-shared';

export function CityAbout({
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
  const items = readText(content, 'variant') === 'columns' ? readCityItems(content) : [];

  if (!title && !body && items.length === 0) return null;

  // A background image turns the section dark, the same way the giving cover reads.
  const onDark = Boolean(readText(content, 'backgroundImageUrl'));

  return (
    <section
      className={`px-5 py-14 lg:py-[104px] ${onDark ? 'text-white' : 'text-[#0a0a0a]'}`}
      id="about"
      style={onDark ? coverStyle(content) : undefined}
    >
      <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-8 lg:gap-12">
        <div className="flex max-w-[760px] flex-col gap-5 sm:gap-6">
          <CityEyebrow
            className={onDark ? 'text-white/70' : ''}
            style={onDark ? undefined : { color: theme.accentInk }}
          >
            {readText(content, 'eyebrow')}
          </CityEyebrow>
          {title ? (
            <CityHeading className={onDark ? 'text-white text-balance' : 'text-balance'}>
              {title}
            </CityHeading>
          ) : null}
          {body ? (
            <p
              className={`m-0 text-[16px] leading-[1.7] sm:text-[18px] ${
                onDark ? 'text-white/85' : 'text-[#3d3d3d]'
              }`}
            >
              {body}
            </p>
          ) : null}
          <CityButtons content={content} onDark={onDark} theme={theme} website={website} />
        </div>
        {items.length > 0 ? <AboutColumns items={items} onDark={onDark} /> : null}
      </div>
    </section>
  );
}

function AboutColumns({ items, onDark }: { items: CityItem[]; onDark: boolean }) {
  return (
    <ul className="m-0 grid list-none gap-0 p-0 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item, index) => (
        <li
          className={`flex flex-col gap-3 border-t px-0 py-6 sm:px-6 sm:py-7 ${
            onDark ? 'border-white/25' : 'border-[#e5e5e5]'
          } ${index > 0 ? 'sm:border-l' : ''} sm:first:pl-0`}
          key={item.title}
        >
          <h3 className="m-0 text-[18px] font-extrabold uppercase leading-[1.15] tracking-[-0.01em] sm:text-[20px]">
            {item.title}
          </h3>
          {item.body ? (
            <p
              className={`m-0 text-[15px] leading-[1.6] ${
                onDark ? 'text-white/75' : 'text-[#6b6b6b]'
              }`}
            >
              {item.body}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
