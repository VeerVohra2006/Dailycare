// ═══════════════════════════════════════════════════════════════
//  DailyCare Service Worker  —  sw.js  v8
//
//  Only job: receive Web Push from the backend and show it.
//  All scheduling is done server-side (cron job).
//  No local alarm loops, no timers, no complexity.
//
//  Push works on:
//    Android Chrome/PWA  — always, locked screen ✅
//    iOS 16.4+ as PWA    — locked screen ✅
//    iOS in browser tab  — not supported by Apple ❌
// ═══════════════════════════════════════════════════════════════

const CACHE_NAME   = 'dailycare-v8';
const OFFLINE_PAGE = 'index.html';

const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=Lato:wght@300;400;700;900&family=Playfair+Display:wght@500;700&display=swap'
];

// ════════════════════════════════════
//  INSTALL
// ════════════════════════════════════
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(c => c.addAll(PRECACHE).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

// ════════════════════════════════════
//  ACTIVATE
// ════════════════════════════════════
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ════════════════════════════════════
//  FETCH — cache-first for app shell
// ════════════════════════════════════
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

// ════════════════════════════════════
//  MESSAGE — page → SW
//  Only handles SKIP_WAITING now.
// ════════════════════════════════════
self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

// ════════════════════════════════════
//  PUSH — backend → SW → notification
//
//  Backend sends this payload:
//  {
//    title: "💊 Time for Metformin",
//    body:  "Veer, it's time to take your Metformin.",
//    type:  "medicine" | "water" | "ping",
//    icon:  "/icons/icon-192.png",
//    badge: "/icons/icon-192.png"
//  }
// ════════════════════════════════════
self.addEventListener('push', e => {
  if (!e.data) return;

  let payload;
  try { payload = e.data.json(); }
  catch (_) { return; }

  const title = payload.title || 'DailyCare Reminder';
  const body  = payload.body  || 'Time for your reminder.';
  const type  = payload.type  || 'reminder';

  e.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon:               payload.icon  || './icons/icon-192.png',
      badge:              payload.badge || './icons/icon-192.png',
      tag:                'dailycare-' + type,
      renotify:           true,
      requireInteraction: true,          // stays on screen until user taps
      vibrate:            [400, 150, 400, 150, 600],
      silent:             false,
      data:               { url: './', type }
    })
  );
});

// ════════════════════════════════════
//  NOTIFICATION CLICK
//  Opens or focuses the app when
//  user taps the notification.
// ════════════════════════════════════
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