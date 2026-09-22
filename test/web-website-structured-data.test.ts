import assert from 'node:assert/strict';
import test from 'node:test';
import {
  churchStructuredData,
  structuredDataJson,
  type StructuredDataPage,
} from '../apps/web/app/(public)/o/_lib/website-structured-data.ts';

const URL_UNDER_TEST = 'https://churchflow.test/o/grace';

function page(
  overrides: {
    websiteTitle?: string;
    websiteDescription?: string | null;
    logoUrl?: string | null;
    pageNoindex?: boolean;
    seoDescription?: string | null;
    seoNoindex?: boolean;
    location?: { address?: string };
    socials?: Record<string, string>;
    serviceTimes?: Array<{
      weekday: number;
      time: string;
      durationMinutes: number;
      label?: string;
    }>;
  } = {},
): StructuredDataPage {
  return {
    seo: { noindex: overrides.pageNoindex ?? false },
    website: {
      title: overrides.websiteTitle ?? 'Grace Church',
      description: overrides.websiteDescription ?? null,
      settings: {
        seo: {
          description: overrides.seoDescription ?? null,
          noindex: overrides.seoNoindex ?? false,
        },
        socials: overrides.socials ?? {},
        location: overrides.location ?? {},
        serviceTimes: overrides.serviceTimes ?? [],
      },
      organization: { logoUrl: overrides.logoUrl ?? null },
    },
  };
}

test('a fully filled website becomes a Church node with address, socials and service hours', () => {
  const data = churchStructuredData({
    page: page({
      websiteDescription: 'A church in the city centre',
      logoUrl: 'https://media.test/logo.png?signature=abc',
      location: { address: '12 Market Street' },
      socials: {
        youtube: 'https://youtube.com/@grace',
        facebook: 'https://facebook.com/grace',
      },
      serviceTimes: [
        { weekday: 0, time: '10:00', durationMinutes: 90, label: 'Morning service' },
        { weekday: 3, time: '19:00', durationMinutes: 60 },
      ],
    }),
    url: URL_UNDER_TEST,
  });

  assert.deepEqual(data, {
    '@context': 'https://schema.org',
    '@type': 'Church',
    name: 'Grace Church',
    url: URL_UNDER_TEST,
    description: 'A church in the city centre',
    logo: 'https://media.test/logo.png?signature=abc',
    sameAs: ['https://facebook.com/grace', 'https://youtube.com/@grace'],
    address: { '@type': 'PostalAddress', streetAddress: '12 Market Street' },
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: 'Sunday',
        opens: '10:00',
        closes: '11:30',
        name: 'Morning service',
      },
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: 'Wednesday',
        opens: '19:00',
        closes: '20:00',
      },
    ],
  });
});

test('the SEO description wins over the website description', () => {
  const data = churchStructuredData({
    page: page({
      websiteDescription: 'Stored description',
      seoDescription: 'Search description',
    }),
    url: URL_UNDER_TEST,
  });

  assert.equal(data?.description, 'Search description');
});

test('a website with no address, socials or service times omits those keys entirely', () => {
  const data = churchStructuredData({ page: page(), url: URL_UNDER_TEST });

  assert.deepEqual(data, {
    '@context': 'https://schema.org',
    '@type': 'Church',
    name: 'Grace Church',
    url: URL_UNDER_TEST,
  });
  assert.equal(Object.hasOwn(data ?? {}, 'sameAs'), false);
  assert.equal(Object.hasOwn(data ?? {}, 'address'), false);
  assert.equal(Object.hasOwn(data ?? {}, 'openingHoursSpecification'), false);
  assert.equal(Object.hasOwn(data ?? {}, 'logo'), false);
  assert.equal(Object.hasOwn(data ?? {}, 'description'), false);
});

test('blank stored strings are treated as missing data', () => {
  const data = churchStructuredData({
    page: page({
      websiteDescription: '   ',
      logoUrl: '',
      location: { address: '  ' },
      socials: { instagram: '   ' },
      serviceTimes: [{ weekday: 1, time: '10:00', durationMinutes: 60, label: '  ' }],
    }),
    url: URL_UNDER_TEST,
  });

  assert.equal(Object.hasOwn(data ?? {}, 'description'), false);
  assert.equal(Object.hasOwn(data ?? {}, 'logo'), false);
  assert.equal(Object.hasOwn(data ?? {}, 'address'), false);
  assert.equal(Object.hasOwn(data ?? {}, 'sameAs'), false);
  assert.equal(Object.hasOwn(data?.openingHoursSpecification?.[0] ?? {}, 'name'), false);
});

test('a service running past midnight closes at the end of its own day', () => {
  const data = churchStructuredData({
    page: page({ serviceTimes: [{ weekday: 6, time: '23:00', durationMinutes: 180 }] }),
    url: URL_UNDER_TEST,
  });

  assert.equal(data?.openingHoursSpecification?.[0]?.closes, '23:59');
});

test('a malformed service time is skipped instead of emitting a broken specification', () => {
  const data = churchStructuredData({
    page: page({
      serviceTimes: [
        { weekday: 9, time: '10:00', durationMinutes: 60 },
        { weekday: 1, time: 'noon', durationMinutes: 60 },
      ],
    }),
    url: URL_UNDER_TEST,
  });

  assert.equal(Object.hasOwn(data ?? {}, 'openingHoursSpecification'), false);
});

test('a page marked noindex emits no structured data', () => {
  assert.equal(
    churchStructuredData({ page: page({ pageNoindex: true }), url: URL_UNDER_TEST }),
    null,
  );
});

test('a website marked noindex emits no structured data for any of its pages', () => {
  assert.equal(
    churchStructuredData({ page: page({ seoNoindex: true }), url: URL_UNDER_TEST }),
    null,
  );
});

test('a hostile website title cannot close the script element', () => {
  const data = churchStructuredData({
    page: page({ websiteTitle: 'Grace</script><script>alert(1)</script>' }),
    url: URL_UNDER_TEST,
  });
  assert.ok(data);

  const json = structuredDataJson(data);

  assert.equal(json.includes('<'), false);
  assert.equal(json.includes('</script>'), false);
  assert.equal(JSON.parse(json).name, 'Grace</script><script>alert(1)</script>');
});
