/* MiEx service worker
 * Strategy:
 *  - Pages (navigation): network first (always the latest when online). The last good
 *    copy is kept so the app still opens with no connection.
 *  - CSS / JS / manifest: network first, cached copy as fallback.
 *  - Fonts, Chart.js, icons: cache first (they never change).
 * Bump VERSION whenever you publish a new release so old caches are cleaned up.
 */
const VERSION = 'v6';
const CACHE = 'miex-' + VERSION;
const NAV_TIMEOUT_MS = 6000;

const APP_SHELL = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  './privacy.html',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
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

// Shown only if someone opens MiEx for the very first time with no connection at all.
const OFFLINE_PAGE = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>MiEx - Offline</title>
<style>
  html,body{height:100%;margin:0;display:flex;align-items:center;justify-content:center;background:#FDF8F1;color:#2E2418;font-family:-apple-system,"Segoe UI",Roboto,Arial,sans-serif;text-align:center;padding:24px;box-sizing:border-box}
  .box{max-width:320px}
  .icon{width:64px;height:64px;border-radius:16px;background:#F68B1E;color:#fff;display:flex;align-items:center;justify-content:center;font-size:28px;margin:0 auto 18px}
  h1{font-size:1.2rem;margin:0 0 8px}
  p{font-size:.9rem;color:#8C7C6B;margin:0 0 20px}
  button{background:#F68B1E;color:#fff;border:0;border-radius:999px;padding:12px 28px;font-size:.9rem;font-weight:700}
  #s{margin-top:14px;font-size:.78rem;color:#8C7C6B}
</style></head><body>
<div class="box"><div class="icon">&#128225;</div>
<h1>You're offline</h1>
<p>MiEx hasn't been opened on this device yet, so there's nothing saved to show. Connect to the internet once and it will work offline from then on.</p>
<button id="retry">Try again</button><div id="s"></div></div>
<script>
  function retry(){document.getElementById('s').textContent='Checking connection...';
    fetch(location.href,{cache:'no-store'}).then(function(r){if(r.ok)location.reload();else done()}).catch(done)}
  function done(){document.getElementById('s').textContent='Still offline.'}
  document.getElementById('retry').addEventListener('click',retry);
  window.addEventListener('online',retry);
</script></body></html>`;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.all(
        APP_SHELL.map((url) =>
          // cache:'reload' skips the browser HTTP cache so we always store fresh copies
          cache.add(new Request(url, { cache: 'reload' })).catch((err) => {
            console.warn('[sw] could not pre-cache', url, err && err.message);
          })
        )
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('miex-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // never touch other sites

  if (req.mode === 'navigate') {
    event.respondWith(handleNavigation(req));
    return;
  }
  if (/\/(vendor|icons)\//.test(url.pathname)) {
    event.respondWith(cacheFirst(req, url));
    return;
  }
  event.respondWith(networkFirst(req, url));
});

// Cache key without the ?v=… query so versions don't pile up
function keyFor(url) {
  return new Request(url.origin + url.pathname);
}

function timeout(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));
}

async function handleNavigation(req) {
  try {
    const res = await Promise.race([fetch(req), timeout(NAV_TIMEOUT_MS)]);
    if (res && res.ok && res.type === 'basic') {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put('./index.html', copy)).catch(() => {});
    }
    return res; // includes redirects (opaqueredirect) — the browser follows them itself
  } catch (err) {
    const cache = await caches.open(CACHE);
    const cached = (await cache.match('./index.html')) || (await cache.match('./'));
    return cached || new Response(OFFLINE_PAGE, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
}

async function networkFirst(req, url) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    if (res && res.ok && res.type === 'basic') cache.put(keyFor(url), res.clone()).catch(() => {});
    return res;
  } catch (err) {
    const cached = await cache.match(keyFor(url), { ignoreSearch: true });
    if (cached) return cached;
    throw err;
  }
}

async function cacheFirst(req, url) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(keyFor(url), { ignoreSearch: true });
  if (cached) return cached;
  const res = await fetch(req);
  if (res && res.ok && res.type === 'basic') cache.put(keyFor(url), res.clone()).catch(() => {});
  return res;
}
