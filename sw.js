/**
 * AMPACT Service Worker - v6.3.5
 * Optimized for PWA Installation Triggers
 */

const CACHE_NAME = 'ampact-cache-v6.3.5';
const ASSETS = [
  './',
  './index.html',
  './app.js',
  './manifest.json',
  './data.xlsx',
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
];

// Force immediate installation
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

// Clean up old caches and take control immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
    ))
  );
  self.clients.claim();
});

// Network-first strategy for the data file, cache-first for others
self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('data.xlsx')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
  } else {
    event.respondWith(
      caches.match(event.request).then((response) => response || fetch(event.request))
    );
  }
});
