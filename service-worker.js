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
    clients.forEach(client => client.postMessage(message));
  });
}

/**
 * Checks a remote kill switch file. If 'disablePWA' is true,
 * the service worker unregisters itself and sends a message to clients.
 */
async function checkKillSwitch() {
  try {
    const response = await fetch('/kill-switch.json', { cache: 'no-store' }); // Always fetch fresh
    if (!response.ok) {
      console.warn('Kill switch file not found or inaccessible. Assuming PWA is active.');
      return;
    }
    const config = await response.json();
    if (config.disablePWA === true) {
      console.log('Kill switch activated: Unregistering service worker.');
      sendMessageToClients({ type: 'PWA_DISABLED', message: 'The Admin Duck has revoked all rights to use this app.' });
      await self.registration.unregister();
    } else {
      console.log('Kill switch is off. PWA remains active.');
    }
  } catch (error) {
    console.error('Error checking kill switch:', error);
  }
}

// Install event: Cache essential assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
      .catch(err => {
        console.error('Failed to cache during install:', err);
      })
  );
});

// Activate event: Clean up old caches and check kill switch
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            // Delete old caches
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // After caches are cleaned, check the kill switch
      return checkKillSwitch();
    })
  );
});

// Fetch event: Serve cached assets or fetch from network, and check kill switch for main page
self.addEventListener('fetch', (event) => {
  // Check kill switch when the main index.html is requested
  if (event.request.url.includes('index.html')) {
    event.waitUntil(checkKillSwitch());
  }

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
        console.error('Fetch failed:', err);
        // You could return an offline page here if desired
        // For now, it will just fail gracefully
      })
  );
});

