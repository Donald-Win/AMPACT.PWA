const CACHE_NAME = 'ampact-cache-v13.2.0';
const ASSETS = [
  './',
  './index.html',
  './app.js',
  './manifest.json',
  './data.csv'
  // NOTE: Airtable kill-switch is fetched directly via API - not a local file
];

self.addEventListener('install', (e) => {
  console.log('[Service Worker] Installing v13.2.0');
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[Service Worker] Caching assets');
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('activate', (e) => {
  console.log('[Service Worker] Activating v13.2.0');
  e.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => {
      console.log('[Service Worker] Activated');
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  
  // CRITICAL: kill-switch.json must NEVER be cached
  // Always fetch fresh from network to ensure immediate updates
  if (url.pathname.endsWith('kill-switch.json')) {
    e.respondWith(
      fetch(e.request, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      }).catch(() => {
        // If network fails, allow access (fail open for safety)
        return new Response(JSON.stringify({ enabled: false, mode: 'open' }), {
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
  } 
  // For data.csv, use stale-while-revalidate strategy
  else if (url.pathname.endsWith('data.csv')) {
    e.respondWith(
      caches.open(CACHE_NAME).then(cache => {
        return cache.match(e.request).then(cachedResponse => {
          const fetchPromise = fetch(e.request).then(networkResponse => {
            // Update cache in background
            cache.put(e.request, networkResponse.clone());
            return networkResponse;
          }).catch(() => {
            // If network fails, return cached version
            return cachedResponse;
          });
          
          // Return cached version immediately if available, otherwise wait for network
          return cachedResponse || fetchPromise;
        });
      })
    );
  } 
  // Cache-first strategy for other assets
  else {
    e.respondWith(
      caches.match(e.request).then(res => {
        return res || fetch(e.request).catch(() => {
          // Return offline fallback if needed
          if (e.request.destination === 'document') {
            return caches.match('./index.html');
          }
        });
      })
    );
  }
});
