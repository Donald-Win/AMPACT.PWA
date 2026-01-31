/**
 * AMPACT Service Worker - v6.3.8
 * Matching GitHub folder structure exactly.
 */

const CACHE_NAME = 'ampact-cache-v6.3.8';
const ASSETS = [
  './',
  './index.html',
  './app.js',
  './manifest.json',
  './data.xlsx',
  './icons/icon-192x192.png',
  './icons/icon-512x512.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Use Settled to ensure one missing icon doesn't kill the whole app
      return Promise.allSettled(ASSETS.map(url => cache.add(url)));
    })
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
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
