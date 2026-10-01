const CACHE_NAME = 'miex-cache-v5';

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

// A branded, interactive fallback page shown only when there's truly no
// connection and the network fetch for the page itself fails.
const OFFLINE_PAGE = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>MiEx — Offline</title>
<style>
  html, body {
    height: 100%;
    margin: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #FDF8F1;
    color: #2E2418;
    font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif;
    text-align: center;
    padding: 24px;
  }
  .box { max-width: 320px; }
  .icon {
    width: 64px;
    height: 64px;
    border-radius: 16px;
    background: #F68B1E;
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 28px;
    margin: 0 auto 18px;
  }
  h1 { font-size: 1.2rem; margin: 0 0 8px; }
  p { font-size: 0.9rem; color: #8C7C6B; margin: 0 0 20px; }
  button {
    background: #F68B1E;
    color: #fff;
    border: none;
    border-radius: 999px;
    padding: 12px 28px;
    font-size: 0.9rem;
    font-weight: 700;
    cursor: pointer;
  }
  button:active { opacity: 0.85; }
  #status { margin-top: 14px; font-size: 0.78rem; color: #8C7C6B; }
</style>
</head>
<body>
  <div class="box">
    <div class="icon">📡</div>
    <h1>You're offline</h1>
    <p>MiEx needs a connection to load right now. Check your internet and try again.</p>
    <button onclick="location.reload()">Try Again</button>
    <div id="status">Waiting for connection…</div>
  </div>
  <script>
    // Auto-reload the moment the connection comes back — no manual tap needed.
    window.addEventListener('online', () => location.reload());
    if (navigator.onLine) location.reload();
  </script>
</body>
</html>
`;

// Install: back up each asset individually so one bad path doesn't
// silently fail the whole install.
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
// - Page navigations: network-only. Falls back to the branded, interactive
//   offline page only if there's truly no connection.
// - Everything else (CSS/JS/fonts/icons): network-first, falling back to
//   the cached backup only if offline.
self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response(OFFLINE_PAGE, { headers: { 'Content-Type': 'text/html' } })
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
