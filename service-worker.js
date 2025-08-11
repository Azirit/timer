const VERSION = 'v1.0.3';
const STATIC_CACHE = `timer-static-${VERSION}`;
const ASSETS = [
  '/styles.css',
  '/script.js',
  '/favicon.svg',
  '/safari-pinned-tab.svg',
  '/manifest.webmanifest'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((k) => {
      if (k !== STATIC_CACHE && k.startsWith('timer-static-')) return caches.delete(k);
    })))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  // HTML навигации — всегда пробуем сеть сначала
  if (request.mode === 'navigate' || (request.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(
      fetch(request).then((resp) => {
        const copy = resp.clone();
        caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy)).catch(()=>{});
        return resp;
      }).catch(() => caches.match(request))
    );
    return;
  }

  // Скрипты/стили — stale-while-revalidate
  const dest = request.destination;
  if (dest === 'script' || dest === 'style') {
    event.respondWith((async () => {
      const cache = await caches.open(STATIC_CACHE);
      const cached = await cache.match(request);
      const networkFetch = fetch(request).then((resp) => { cache.put(request, resp.clone()); return resp; }).catch(()=> null);
      return cached || (await networkFetch) || fetch(request);
    })());
    return;
  }

  // Остальное — cache-first
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((resp) => {
        const copy = resp.clone();
        caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy)).catch(()=>{});
        return resp;
      });
    })
  );
});
