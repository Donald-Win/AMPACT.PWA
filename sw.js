const CACHE_NAME = 'ampact-cache-v13.6.0';

// Must all exist, or install fails and the old service worker keeps running.
const CORE_ASSETS = [
  './',
  './index.html',
  './app.js',
  './styles.css',
  './manifest.json',
  './data.csv',
  './fonts/inter-latin-wght-normal.woff2'
];

// Nice to have; a missing icon must not break installation.
const OPTIONAL_ASSETS = [
  './icons/icon-192x192.png',
  './icons/icon-512x512.png',
  './icons/icon-maskable-512x512.png'
];

self.addEventListener('install', (e) => {
  console.log('[Service Worker] Installing', CACHE_NAME);
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await cache.addAll(CORE_ASSETS);
      await Promise.allSettled(OPTIONAL_ASSETS.map((url) => cache.add(url)));
      console.log('[Service Worker] Cached assets');
    })
  );
});

self.addEventListener('activate', (e) => {
  console.log('[Service Worker] Activating', CACHE_NAME);
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(key => (key !== CACHE_NAME ? caches.delete(key) : undefined)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Leave non-GET and cross-origin requests (e.g. the access-control Worker) alone.
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;

  // data.csv: stale-while-revalidate, but only store good responses.
  if (url.pathname.endsWith('data.csv')) {
    e.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(e.request);
        const network = fetch(e.request)
          .then((res) => {
            if (res.ok) cache.put(e.request, res.clone());
            return res;
          })
          .catch(() => cached || Response.error());
        return cached || network;
      })
    );
    return;
  }

  // Everything else: cache-first. ignoreSearch lets index.html?mode=reverse
  // (the manifest shortcut) hit the cached index.html while offline.
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((res) => {
      return res || fetch(e.request).catch(() => {
        if (e.request.destination === 'document') {
          return caches.match('./index.html');
        }
        return Response.error();
      });
    })
  );
});

// Handle skip waiting message from app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
