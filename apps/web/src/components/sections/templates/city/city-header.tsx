import type { PublicWebsiteSummary } from '../../types';
import { cityMessages, resolveWebsiteHref } from './city-shared';

export function CityHeader({
  standalone = false,
  website,
}: {
  standalone?: boolean;
  website: PublicWebsiteSummary | undefined;
}) {
  const navigation = website?.settings?.navigation ?? [];
  const messages = cityMessages(website);
  const logoUrl = website?.organization?.logoUrl;

  return (
    <header
      className={`flex w-full items-center justify-between gap-6 px-5 py-5 text-white lg:py-7 ${
        standalone ? 'bg-[#0a0a0a]' : 'mx-auto max-w-[1240px]'
      }`}
    >
      <a
        className="flex items-center gap-3 text-[13px] font-extrabold uppercase tracking-[0.22em] text-white no-underline hover:no-underline sm:text-[15px]"
        href={website?.organization ? `/o/${website.organization.slug}` : '#'}
      >
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt={website?.title ?? ''}
            className="size-[34px] shrink-0 object-contain"
            src={logoUrl}
          />
        ) : (
          <span
            aria-hidden="true"
            className="inline-flex size-[34px] items-center justify-center border-2 border-white"
          >
            <svg
              fill="none"
              height="18"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="2.5"
              viewBox="0 0 24 24"
              width="18"
            >
              <path d="M12 3v18" />
              <path d="M6 9h12" />
            </svg>
          </span>
        )}
        {website?.title}
      </a>

      {navigation.length > 0 ? (
        <>
          <nav aria-label={messages.menu} className="hidden items-center gap-8 lg:flex">
            {navigation.map((link) => (
              <a
                className="text-[13px] font-semibold uppercase tracking-[0.1em] text-white no-underline hover:text-white/70 hover:no-underline"
                href={resolveWebsiteHref(link.href, website)}
                key={`${link.label}:${link.href}`}
              >
                {link.label}
              </a>
            ))}
          </nav>
          <details className="relative lg:hidden">
            <summary
              aria-label={messages.menu}
              className="flex size-11 cursor-pointer list-none items-center justify-center [&::-webkit-details-marker]:hidden"
            >
              <svg
                fill="none"
                height="24"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                width="24"
              >
                <path d="M4 7h16" />
                <path d="M4 12h16" />
                <path d="M4 17h16" />
              </svg>
            </summary>
            <nav
              aria-label={messages.menu}
              className="absolute right-0 top-12 z-10 flex min-w-[220px] flex-col bg-[#0a0a0a] py-2 shadow-lg"
            >
              {navigation.map((link) => (
                <a
                  className="px-5 py-3 text-[13px] font-semibold uppercase tracking-[0.1em] text-white no-underline hover:bg-white/10 hover:no-underline"
                  href={resolveWebsiteHref(link.href, website)}
                  key={`${link.label}:${link.href}`}
                >
                  {link.label}
                </a>
              ))}
            </nav>
          </details>
        </>
      ) : null}
    </header>
  );
}
