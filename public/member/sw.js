// Minimal service worker — its job is mostly to make Avva installable
// ("Add to Home Screen") on Android/Chrome, which requires an active service
// worker with a fetch handler. Caches the app shell so the icon/splash and
// basic navigation still work on a flaky connection; all /api/ calls always
// go to the network since that's live member data.

const CACHE_NAME = 'avva-shell-v1';
const SHELL_FILES = ['/app/index.html', '/app/style.css', '/app/app.js', '/app/manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/api/')) return; // always live

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((resp) => {
          if (resp.ok) caches.open(CACHE_NAME).then((cache) => cache.put(event.request, resp.clone()));
          return resp;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
