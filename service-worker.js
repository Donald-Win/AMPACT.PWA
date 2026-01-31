// Version v2.0.1
const CACHE_NAME = 'ampact-selector-v2-0-1';

const urlsToCache = [
  './',
  'index.html',
  'app.js',
  'data.json',
  'manifest.json',
  'icons/icon-192x192.png',
  'icons/icon-512x512.png',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('SW: Purging old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Always let kill-switch go to network
  if (event.request.url.includes('kill-switch.json')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Stale-While-Revalidate Strategy
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        }).catch(() => {
          // Network failed, silently fail so cachedResponse handles it
        });

        return cachedResponse || fetchPromise;
      });
    })
  );
});
