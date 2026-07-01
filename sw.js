// ═══════════════════════════════════════════════════════════════
//  DailyCare Service Worker  —  sw.js  v9
// ═══════════════════════════════════════════════════════════════

const CACHE_NAME   = 'dailycare-v9';
const OFFLINE_PAGE = 'index.html';

const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=Lato:wght@300;400;700;900&family=Playfair+Display:wght@500;700&display=swap'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(c => c.addAll(PRECACHE).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.hostname === 'ntfy.sh') return;

  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(res => {
          if (e.request.method === 'GET' && res.status === 200) {
            caches.open(CACHE_NAME).then(c => c.put(e.request, res.clone()));
          }
          return res;
        }).catch(() => caches.match(OFFLINE_PAGE));
      })
    );
    return;
  }
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});

self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

// ═══════════════════════════════════════════════════════════════
//  PUSH DISPATCH LAYER (LOCK SCREEN AND background FOCUS TUNED)
// ═══════════════════════════════════════════════════════════════
self.addEventListener('push', e => {
  if (!e.data) return;

  let payload;
  try { 
    payload = e.data.json(); 
  } catch (_) { 
    // Secure clear-text raw string payload conversions
    payload = { title: 'DailyCare Reminder', body: e.data.text(), type: 'medicine' };
  }

  const title = payload.title || 'DailyCare Reminder';
  const body  = payload.body  || 'Time for your scheduled health log item.';
  const type  = payload.type  || 'reminder';

  const options = {
    body: body,
    icon: payload.icon || './icons/icon-192.png',
    badge: payload.badge || './icons/icon-192.png',
    tag: 'dailycare-' + type,
    
    // Critical parameters ensuring high device visibility across all locking modes:
    renotify: true,
    requireInteraction: true,          // Prevents system banner auto-dismiss timeouts
    vibrate: [500, 110, 500, 110, 450, 110, 600],
    silent: false,
    
    // System metadata markers allowing cross-origin application window matching
    data: { url: './', type: type }
  };

  e.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(clients => {
        for (const client of clients) {
          if (client.url.includes(self.location.origin) && 'focus' in client)
            return client.focus();
        }
        if (self.clients.openWindow) return self.clients.openWindow('./');
      })
  );
});