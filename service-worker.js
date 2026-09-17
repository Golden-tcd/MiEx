const CACHE_NAME = 'miex-cache-v4';

// Only static assets that rarely change get an offline backup.
// index.html is deliberately excluded — it should always come from
// the network when online, so edits/fixes are never masked by a stale copy.
const ASSETS_TO_CACHE = [
  './style.css',
  './script.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './vendor/js/chart.umd.js',
  './vendor/fonts/quicksand-latin-500-normal.woff2',
  './vendor/fonts/quicksand-latin-600-normal.woff2',
  './vendor/fonts/quicksand-latin-700-normal.woff2',
  './vendor/fonts/nunito-latin-400-normal.woff2',
  './vendor/fonts/nunito-latin-500-normal.woff2',
  './vendor/fonts/nunito-latin-600-normal.woff2',
  './vendor/fonts/nunito-latin-700-normal.woff2',
  './vendor/fonts/nunito-latin-800-normal.woff2'
];

// Install: back up each asset individually so one bad path doesn't
// silently fail the whole install (which was blocking installability).
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(
        ASSETS_TO_CACHE.map((url) =>
          cache.add(url).catch((err) => {
            console.warn('Service worker: failed to pre-cache', url, err);
          })
        )
      )
    )
  );
  self.skipWaiting();
});

// Activate: clean up any older caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

// Fetch strategy:
// - Page navigations (loading index.html itself): network-only.
//   Never served from cache, so fixes/edits always show immediately.
// - Everything else (CSS/JS/icons): network-first, falling back to the
//   cached backup only if there's genuinely no connection.
self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response(
          '<h1>You appear to be offline.</h1><p>Reconnect and reload to use MiEx.</p>',
          { headers: { 'Content-Type': 'text/html' } }
        )
      )
    );
    return;
  }

  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
        return response;
      })
      .catch(() => caches.match(event.request, { ignoreSearch: true }))
  );
});
