const CACHE_NAME = 'ampact-cache-v13.6.4';

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
  // No skipWaiting() here: a new version waits until the user taps "Update Now"
  // (the app then sends SKIP_WAITING). First-ever install still activates immediately.
  e.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // cache:'reload' bypasses the browser HTTP cache so we never store stale
      // copies (GitHub Pages serves files with a 10 minute max-age).
      await Promise.all(CORE_ASSETS.map((url) => cache.add(new Request(url, { cache: 'reload' }))));
      await Promise.allSettled(OPTIONAL_ASSETS.map((url) => cache.add(new Request(url, { cache: 'reload' }))));
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
