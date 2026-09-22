import type { WebsiteLink } from '@churchflow/shared';
import { readText, type PublicWebsiteSummary } from '../../types';
import { cityMessages, formatServiceTime, resolveWebsiteHref } from './city-shared';

const SOCIAL_LINKS = [
  { key: 'instagram', label: 'Instagram', icon: '/icons/socials/insta.svg' },
  { key: 'youtube', label: 'YouTube', icon: null },
  { key: 'facebook', label: 'Facebook', icon: '/icons/socials/meta.svg' },
  { key: 'telegram', label: 'Telegram', icon: '/icons/socials/telegram.svg' },
] as const;

export function CityFooter({
  content,
  website,
}: {
  content: Record<string, unknown>;
  website: PublicWebsiteSummary | undefined;
}) {
  const messages = cityMessages(website);
  const settings = website?.settings;
  const locale = settings?.locale ?? 'en';
  const address = readText(content, 'address') || settings?.location?.address || '';
  const links = readLinks(content['links']);
  const navigation = links.length > 0 ? links : (settings?.navigation ?? []);
  const socials = SOCIAL_LINKS.map((social) => ({
    ...social,
    href: settings?.socials?.[social.key] ?? '',
  })).filter((social) => social.href);
  const email = readText(content, 'email');
  const phone = readText(content, 'phone');
  const body = readText(content, 'body');
  const copyright = readText(
    content,
    'copyright',
    `© ${new Date().getFullYear()} ${website?.title ?? ''}`,
  );

  return (
    <footer className="bg-[#0a0a0a] px-5 pb-8 pt-14 text-white lg:pt-[72px]" id="footer">
      <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-10 lg:gap-14">
        <div className="grid gap-10 lg:grid-cols-[2fr_1fr_1fr]">
          <div className="flex flex-col gap-5">
            <span className="text-[18px] font-extrabold uppercase tracking-[0.2em] sm:text-[22px]">
              {readText(content, 'title', website?.title ?? '')}
            </span>
            {body ? (
              <p className="m-0 max-w-[420px] text-[14px] leading-[1.7] text-[#9a9a9a]">{body}</p>
            ) : null}
            {address || (settings?.serviceTimes?.length ?? 0) > 0 ? (
              <p className="m-0 text-[14px] leading-[1.7] text-[#9a9a9a]">
                {address}
                {address && settings?.serviceTimes?.length ? <br /> : null}
                {settings?.serviceTimes
                  ?.map((service) => formatServiceTime(service, locale))
                  .join(' · ')}
              </p>
            ) : null}
            {email || phone ? (
              <p className="m-0 flex flex-col gap-1 text-[14px] text-[#9a9a9a]">
                {email ? (
                  <a className="text-[#9a9a9a] hover:text-white" href={`mailto:${email}`}>
                    {email}
                  </a>
                ) : null}
                {phone ? (
                  <a
                    className="text-[#9a9a9a] hover:text-white"
                    href={`tel:${phone.replace(/\s+/g, '')}`}
                  >
                    {phone}
                  </a>
                ) : null}
              </p>
            ) : null}
            {socials.length > 0 ? (
              <nav aria-label={messages.socialLinks} className="flex gap-3">
                {socials.map((social) => (
                  <a
                    aria-label={social.label}
                    className="inline-flex size-10 items-center justify-center border border-[#333333] text-white hover:bg-white/10"
                    href={social.href}
                    key={social.key}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {social.icon ? (
                      <span
                        aria-hidden="true"
                        className="block size-4 bg-current"
                        style={{
                          WebkitMask: `url(${social.icon}) center / contain no-repeat`,
                          mask: `url(${social.icon}) center / contain no-repeat`,
                        }}
                      />
                    ) : (
                      <svg
                        aria-hidden="true"
                        fill="none"
                        height="16"
                        stroke="currentColor"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                        width="16"
                      >
                        <rect height="14" rx="4" width="20" x="2" y="5" />
                        <polygon points="10 9 15 12 10 15 10 9" />
                      </svg>
                    )}
                  </a>
                ))}
              </nav>
            ) : null}
          </div>
          {navigation.length > 0 ? (
            <nav
              aria-label={messages.menu}
              className="grid grid-cols-2 gap-x-6 gap-y-3 lg:col-span-2 lg:grid-cols-3"
            >
              {navigation.map((link) => (
                <a
                  className="text-[14px] text-[#9a9a9a] no-underline hover:text-white hover:no-underline"
                  href={resolveWebsiteHref(link.href, website)}
                  key={`${link.label}:${link.href}`}
                >
                  {link.label}
                </a>
              ))}
            </nav>
          ) : null}
        </div>
        <div className="flex flex-col gap-2 border-t border-[#262626] pt-6 text-[13px] text-[#6b6b6b] sm:flex-row sm:items-center sm:justify-between">
          <span>{copyright}</span>
          <span>ChurchFlow</span>
        </div>
      </div>
    </footer>
  );
}

function readLinks(value: unknown): WebsiteLink[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((link) => {
    if (typeof link !== 'object' || link === null) return [];
    const record = link as Record<string, unknown>;
    const label = typeof record['label'] === 'string' ? record['label'] : '';
    const href = typeof record['href'] === 'string' ? record['href'] : '';

    return label && href ? [{ label, href }] : [];
  });
}
