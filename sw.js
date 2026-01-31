/**
 * AMPACT Service Worker - v6.3.6
 * Optimized for GitHub Pages subdirectories
 */

const CACHE_NAME = 'ampact-cache-v6.3.6';
const ASSETS = [
  '/AMPACT.PWA/',
  '/AMPACT.PWA/index.html',
  '/AMPACT.PWA/app.js',
  '/AMPACT.PWA/manifest.json',
  '/AMPACT.PWA/data.xlsx',
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => response || fetch(event.request))
  );
});
