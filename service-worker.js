const CACHE_NAME = 'ampact-selector-cache-v2'; // Incremented version

const urlsToCache = [
  './',
  'index.html',
  'app.js',
  'data.json',
  'manifest.json',
  'icons/icon-192x192.png',
  'icons/icon-512x512.png',
];

// Install: Cache essential assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
    }).then(() => self.skipWaiting())
  );
});

// Activate: Clean up old caches
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!cacheWhitelist.includes(cacheName)) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Stale-While-Revalidate strategy
self.addEventListener('fetch', (event) => {
  // We don't cache the kill-switch to ensure it stays "live"
  if (event.request.url.includes('kill-switch.json')) {
    return event.respondWith(fetch(event.request));
  }

  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        }).catch(() => {
            // If network fails, the cachedResponse (if any) will still be returned
        });

        // Return cached version immediately, update cache in background
        return cachedResponse || fetchPromise;
      });
    })
  );
});  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            // Delete old caches
            console.log('SW: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Claim control of all clients (tabs) immediately
      console.log('SW: Calling self.clients.claim()');
      return self.clients.claim(); 
    })
  );
});

// Fetch event: Serve cached assets or fetch from network
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Cache hit - return response
        if (response) {
          return response;
        }
        // No cache hit - fetch from network
        return fetch(event.request);
      })
      .catch(err => {
        console.error('SW: Fetch failed:', err);
      })
  );
});

