// Bump this version when changing the offline page or cache policy.
const CACHE_PREFIX = 'doth-pwa-';
const OFFLINE_CACHE = `${CACHE_PREFIX}offline-v1`;
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(OFFLINE_CACHE).then((cache) => cache.add(new Request(OFFLINE_URL, { cache: 'reload' }))));
  // Do not skip waiting: updates must not take over an active multiplayer session.
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(
    keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== OFFLINE_CACHE).map((key) => caches.delete(key)),
  )));
  // No clients.claim() or forced reloads. Open pages keep their current worker.
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  // Only full home-page navigations are handled. Everything else bypasses this
  // worker, including game/display/packs/API routes, RSC, Socket.IO and assets.
  // WebSocket connections are not handled by service worker fetch events.
  if (request.method !== 'GET' || request.mode !== 'navigate' || url.origin !== self.location.origin || url.pathname !== '/') return;

  event.respondWith(fetch(request, { cache: 'no-store' }).catch(async () => {
    try {
      const cached = await (await caches.open(OFFLINE_CACHE)).match(OFFLINE_URL);
      if (cached) return cached;
    } catch { /* Storage may be unavailable or evicted. */ }
    return new Response('Die on This Hill requires an internet connection to play.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }));
});
