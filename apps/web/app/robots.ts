import type { MetadataRoute } from 'next';
import { serverEnv } from '@/env/server';

// Only the marketing root and the published organization websites under /o/ are content a crawler
// should reach. Everything else is either signed-in surface, a redirect-only endpoint, the owner
// preview of unpublished pages, or a proxy path with no page behind it.
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
        allow: '/',
        disallow: DISALLOWED_PATHS,
      },
    ],
    sitemap: new URL('/sitemap.xml', serverEnv.NEXT_PUBLIC_WEB_URL).toString(),
  };
}
