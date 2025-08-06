const CACHE_NAME = 'ampact-selector-cache-v1';
const urlsToCache = [
  './', // Caches the root URL (index.html)
  'index.html',
  'data.json',
  // Add your icon paths here if you create them
  'icons/icon-192x192.png',
  'icons/icon-512x512.png'
];

/**
 * Sends a message to all active clients (browser tabs/windows).
 * @param {object} message The message object to send.
 */
function sendMessageToClients(message) {
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      console.log('SW: Sending message to client:', message);
      client.postMessage(message);
    });
  });
}

/**
 * Checks a remote kill switch file. If 'disablePWA' is true,
 * the service worker unregisters itself and sends a message to clients.
 */
async function checkKillSwitch() {
  console.log('SW: Checking kill switch...');
  try {
    const response = await fetch('./kill-switch.json', { cache: 'no-store' }); // Always fetch fresh
    if (!response.ok) {
      console.warn('SW: Kill switch file not found or inaccessible. Status:', response.status);
      return;
    }
    const config = await response.json();
    console.log('SW: Kill switch config received:', config);

    if (config.disablePWA === true) {
      console.log('SW: Kill switch ACTIVATED. Unregistering service worker.');
      sendMessageToClients({ type: 'PWA_DISABLED', message: 'The Admin Duck has revoked all rights to use this app.' });
      await self.registration.unregister();
      console.log('SW: Service worker unregistered.');
    } else {
      console.log('SW: Kill switch is OFF. PWA remains active.');
    }
  } catch (error) {
    console.error('SW: Error checking kill switch:', error);
  }
}

// Install event: Cache essential assets
self.addEventListener('install', (event) => {
  console.log('SW: Install event fired.');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('SW: Opened cache. Caching URLs:', urlsToCache);
        return cache.addAll(urlsToCache);
      })
      .catch(err => {
        console.error('SW: Failed to cache during install:', err);
      })
  );
});

// Activate event: Clean up old caches and check kill switch
self.addEventListener('activate', (event) => {
  console.log('SW: Activate event fired.');
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
      // After caches are cleaned, check the kill switch
      console.log('SW: Cache cleanup complete. Checking kill switch during activation.');
      return checkKillSwitch();
    })
  );
});

// Fetch event: Serve cached assets or fetch from network, and check kill switch for main page
self.addEventListener('fetch', (event) => {
  // Check kill switch when the main index.html is requested
  if (event.request.url.includes('index.html')) {
    console.log('SW: Fetching index.html. Checking kill switch.');
    event.waitUntil(checkKillSwitch());
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Cache hit - return response
        if (response) {
          // console.log('SW: Serving from cache:', event.request.url); // Too verbose, uncomment if needed
          return response;
        }
        // No cache hit - fetch from network
        // console.log('SW: Fetching from network:', event.request.url); // Too verbose, uncomment if needed
        return fetch(event.request);
      })
      .catch(err => {
        console.error('SW: Fetch failed:', err);
      })
  );
});

