import { publicPageUrl, type PublicPageResponse } from '../_lib/public-website';
import { churchStructuredData, structuredDataJson } from '../_lib/website-structured-data';

/** Structured data for an indexable public page. Renders nothing for a page marked noindex. */
export function WebsiteJsonLd({
  page,
  orgSlug,
  pageSlug,
}: {
  page: PublicPageResponse;
  orgSlug: string;
  pageSlug?: string | undefined;
}) {
  const data = churchStructuredData({ page, url: publicPageUrl({ orgSlug, pageSlug }) });
  if (!data) return null;

  return (
    <script
      dangerouslySetInnerHTML={{ __html: structuredDataJson(data) }}
      type="application/ld+json"
    />
  );
}
