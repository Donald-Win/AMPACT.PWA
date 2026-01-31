/**
 * AMPACT Service Worker - v6.3.7
 * Fix: Relative paths for better reliability on GitHub Pages
 */

const CACHE_NAME = 'ampact-cache-v6.3.7';
const ASSETS = [
  './',
  './index.html',
  './app.js',
  './manifest.json',
  './data.xlsx'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Use addAll but catch individual failures so the whole SW doesn't break
      return Promise.allSettled(
        ASSETS.map(url => cache.add(url))
      );
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
