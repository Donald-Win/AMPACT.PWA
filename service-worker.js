const CACHE_NAME = 'ampact-selector-cache-v1'; // Original cache name for first iteration

const urlsToCache = [
  './', // Caches the root URL (index.html)
  'index.html',
  'data.json',
  'manifest.json', // Ensure manifest is also cached
  'icons/icon-192x192.png',
  'icons/icon-512x512.png',
  // Note: kill-switch.json is NOT cached by the service worker,
  // as index.html fetches it directly with cache-busting.
];

// Install event: Cache essential assets and force immediate activation
self.addEventListener('install', (event) => {
  console.log('SW: Install event fired. Caching and skipping waiting.');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('SW: Opened cache. Caching URLs:', urlsToCache);
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        // Force the waiting service worker to become the active service worker
        console.log('SW: Calling self.skipWaiting()');
        return self.skipWaiting(); 
      })
      .catch(err => {
        console.error('SW: Failed to cache during install:', err);
      })
  );
});

// Activate event: Clean up old caches and claim clients immediately
self.addEventListener('activate', (event) => {
  console.log('SW: Activate event fired. Cleaning old caches and claiming clients.');
  const cacheWhitelist = [CACHE_NAME];
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

