import type { MetadataRoute } from 'next';
import { serverEnv } from '@/env/server';

// Only the marketing root and the published organization websites under /o/ are content a crawler
// should reach. Everything else is either signed-in surface, a redirect-only endpoint, the owner
// preview of unpublished pages, or a proxy path with no page behind it.

// The one exception under /v1: a published website's images. They are served by the API, which
// answers on its own host in every deployment, so this file does not govern them at all. The
// allowance is here for a deployment that puts the API behind this origin's /v1 rewrite instead,
// where blanket-disallowing /v1 would hide exactly the images the pages advertise as og:image.
const ALLOWED_PATHS = ['/', '/v1/public/website-media/'];
const DISALLOWED_PATHS = [
  '/admin',
  '/api',
  '/dashboard',
  '/invitations',
  '/login',
  '/member-claims',
  '/o/preview/',
  '/offline',
  '/organization-request',
  '/organizations/select',
  '/platform-admin',
  '/profile',
  '/signed-out',
  '/v1',
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ALLOWED_PATHS,
        disallow: DISALLOWED_PATHS,
      },
    ],
    sitemap: new URL('/sitemap.xml', serverEnv.NEXT_PUBLIC_WEB_URL).toString(),
  };
}
