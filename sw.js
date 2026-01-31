const CACHE_NAME = 'ampact-cache-v6.2.0';
const ASSETS = [
  './',
  './index.html',
  './app.js',
  './manifest.json',
  './data.xlsx',
  './icons/icon-192x192.png',
  './icons/icon-512x512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
});

self.addEventListener('fetch', (e) => {
  e.respondWith(caches.match(e.request).then(res => res || fetch(e.request)));
});
