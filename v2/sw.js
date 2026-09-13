// SR Group Safety System — Service Worker minimum.
// Tujuan: penuhi syarat "installable PWA" Chrome/Android supaya "Add to Home
// Screen" jadi app terpasang sepenuhnya (ikon bersih, tiada lencana Chrome
// kecil di penjuru, buka standalone tanpa address bar). Sebagai faedah
// tambahan, cache app shell supaya boleh buka semula secara offline.
const CACHE = 'sr-safety-shell-v1';

self.addEventListener('install', function (e) {
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(function (res) {
      var copy = res.clone();
      caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
      return res;
    }).catch(function () {
      return caches.match(e.request);
    })
  );
});
