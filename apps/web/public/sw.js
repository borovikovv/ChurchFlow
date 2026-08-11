const CACHE_NAME = 'churchflow-pwa-v1';
const OFFLINE_URL = '/offline';
const PRECACHE_URLS = [
  OFFLINE_URL,
  '/icons/favicon.png',
  '/icons/pwa-192x192.png',
  '/icons/pwa-512x512.png',
  '/icons/pwa-maskable-512x512.png',
  '/icons/apple-touch-icon.png',
  '/icons/church-flow.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        cache.addAll(
          PRECACHE_URLS.map(
            (url) =>
              new Request(url, {
                credentials: url === OFFLINE_URL ? 'omit' : 'same-origin',
              }),
          ),
        ),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((cacheName) => cacheName !== CACHE_NAME)
            .map((cacheName) => caches.delete(cacheName)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (!shouldHandleRequest(request)) {
    return;
  }

  const url = new URL(request.url);

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (isCacheableStaticAsset(url, request)) {
    event.respondWith(cacheFirst(request));
  }
});

function shouldHandleRequest(request) {
  if (request.method !== 'GET' || request.headers.has('next-action')) {
    return false;
  }

  const url = new URL(request.url);

  return (
    url.origin === self.location.origin &&
    !url.pathname.startsWith('/v1/') &&
    !url.searchParams.has('_rsc')
  );
}

async function networkFirstNavigation(request) {
  try {
    return await fetch(request);
  } catch {
    const cache = await caches.open(CACHE_NAME);
    return (await cache.match(OFFLINE_URL)) ?? Response.error();
  }
}

function isCacheableStaticAsset(url, request) {
  return (
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/_next/static/') ||
    ['font', 'image', 'script', 'style'].includes(request.destination)
  );
}

async function cacheFirst(request) {
  const cached = await caches.match(request);

  if (cached) {
    return cached;
  }

  const response = await fetch(request);

  if (response.ok && response.type === 'basic') {
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
  }

  return response;
}
