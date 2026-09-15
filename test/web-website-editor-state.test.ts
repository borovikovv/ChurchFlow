import assert from 'node:assert/strict';
import test from 'node:test';
import { applyWebsiteMutation } from '../apps/web/app/(dashboard)/dashboard/[orgId]/website/_components/website-editor-state.ts';

const section = (id: string, order: number) => ({
  id,
  type: 'hero' as const,
  order,
  hidden: false,
  content: {},
});
const page = {
  id: 'home',
  slug: 'home',
  title: 'Home',
  status: 'DRAFT' as const,
  seo: {},
  publishedAt: null,
};
const website = {
  id: 'w',
  title: 'Grace',
  description: null,
  publishedAt: null,
  theme: { accent: '#fff', background: '#fff' },
  settings: {
    template: 'city' as const,
    timeZone: 'UTC',
    locale: 'en' as const,
    navigation: [],
    serviceTimes: [],
    location: {},
    live: { mode: 'schedule' as const, isLive: false, leadMinutes: 5 },
    socials: {},
    seo: { noindex: false },
  },
  organization: { name: 'Grace', slug: 'grace' },
};

const state = {
  website,
  pages: [{ ...page, sections: [section('a', 0), section('b', 1), section('c', 2)] }],
};

test('a duplicated section is inserted after its source and later sections shift down', () => {
  const next = applyWebsiteMutation(state, {
    type: 'section-created',
    pageId: 'home',
    section: section('a2', 1),
  });

  assert.deepEqual(
    next.pages[0]?.sections.map((item) => `${item.id}:${item.order}`),
    ['a:0', 'a2:1', 'b:2', 'c:3'],
  );
});

test('a section appended at the end does not move anything', () => {
  const next = applyWebsiteMutation(state, {
    type: 'section-created',
    pageId: 'home',
    section: section('d', 3),
  });

  assert.deepEqual(
    next.pages[0]?.sections.map((item) => item.id),
    ['a', 'b', 'c', 'd'],
  );
});

test('applying a template replaces the website and upserts the returned page', () => {
  const next = applyWebsiteMutation(state, {
    type: 'template-applied',
    website: { ...website, settings: { ...website.settings, template: 'default' } },
    page: { ...page, sections: [section('a', 0)] },
  });

  assert.equal(next.website.settings.template, 'default');
  assert.equal(next.pages.length, 1);
  assert.deepEqual(
    next.pages[0]?.sections.map((item) => item.id),
    ['a'],
  );
});

test('deleting a section removes it from every page and keeps the rest untouched', () => {
  const next = applyWebsiteMutation(state, { type: 'section-deleted', sectionId: 'b' });

  assert.deepEqual(
    next.pages[0]?.sections.map((item) => item.id),
    ['a', 'c'],
  );
  assert.equal(next.website, state.website);
});
