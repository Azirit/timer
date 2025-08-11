const VERSION = 'v1.0.0';
const STATIC_CACHE = `timer-static-${VERSION}`;
const ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/script.js',
  '/favicon.svg',
  '/safari-pinned-tab.svg',
  '/manifest.webmanifest'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((k) => {
      if (k !== STATIC_CACHE && k.startsWith('timer-static-')) { return caches.delete(k); }
    })))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((resp) => {
        const copy = resp.clone();
        caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy)).catch(()=>{});
        return resp;
      }).catch(() => cached || new Response('', { status: 504 }));
    })
  );
});
