// ═══════════════════════════════════════════════════════════════
//  DailyCare Service Worker  —  sw.js  v7
//
//  Layers:
//   1. Web Push (backend → SW) — works on Android always,
//      iOS 16.4+ when installed as PWA
//   2. SW setInterval loop — fires alarms while SW alive
//   3. Periodic Background Sync — Android catch-up every ~15 min
//   4. In-page setTimeout — most reliable when app is visible
// ═══════════════════════════════════════════════════════════════

const CACHE_NAME   = 'dailycare-v7';
const OFFLINE_PAGE = 'index.html';

const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=Lato:wght@300;400;700;900&family=Playfair+Display:wght@500;700&display=swap'
];

let _schedule  = [];
let _today     = '';
let _checkLoop = null;

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
//  FETCH — cache-first for shell
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
            const clone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
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
// ════════════════════════════════════
self.addEventListener('message', e => {
  const { type, schedule, today } = e.data || {};
  if (type === 'SKIP_WAITING') { self.skipWaiting(); return; }
  if (type === 'SCHEDULE') {
    _schedule = Array.isArray(schedule) ? schedule : [];
    _today    = today || '';
    startAlarmLoop();
    return;
  }
  if (type === 'PAGE_HIDDEN') {
    startAlarmLoop();
    return;
  }
});

// ════════════════════════════════════
//  PUSH — Web Push delivery
//  Backend sends push → SW shows notification
//  Works on locked screen on Android always,
//  iOS 16.4+ when installed as PWA
// ════════════════════════════════════
self.addEventListener('push', e => {
  if (!e.data) return;
  let payload;
  try { payload = e.data.json(); } catch(_) { return; }

  const title = payload.title || 'DailyCare Reminder';
  const body  = payload.body  || 'Time for your reminder.';

  e.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon:               payload.icon  || './icons/icon-192.png',
      badge:              payload.badge || './icons/icon-192.png',
      tag:                'dailycare-push-' + (payload.type || 'reminder'),
      renotify:           true,
      requireInteraction: true,
      vibrate:            [400, 150, 400, 150, 600],
      silent:             false,
      data:               { url: './', type: payload.type }
    })
  );
});

// ════════════════════════════════════
//  NOTIFICATION CLICK
// ════════════════════════════════════
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client)
          return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('./');
    })
  );
});

// ════════════════════════════════════
//  SW ALARM LOOP (Layer 2)
//  Fires scheduled medicine alarms
//  while SW is alive
// ════════════════════════════════════
function startAlarmLoop() {
  if (_checkLoop) return;
  _checkLoop = setInterval(checkAlarms, 30_000);
  checkAlarms();
}

function checkAlarms() {
  if (!_schedule.length) return;
  const now      = Date.now();
  const todayKey = new Date().toLocaleDateString('en-CA');

  if (_today && _today !== todayKey) {
    _schedule = [];
    clearInterval(_checkLoop); _checkLoop = null;
    return;
  }

  for (const item of _schedule) {
    if (now < item.fireAtUTC)          continue;
    if (now > item.fireAtUTC + 90_000) continue;
    const tag = `dc-alarm-${item.mi}-${item.today}-${item.time}`;
    fireNotification(item.title, item.body, tag);
  }

  _schedule = _schedule.filter(item => item.fireAtUTC + 90_000 > Date.now());
  if (!_schedule.length) { clearInterval(_checkLoop); _checkLoop = null; }
}

// ════════════════════════════════════
//  PERIODIC BACKGROUND SYNC (Layer 3)
//  Android: OS wakes SW every ~15 min
// ════════════════════════════════════
self.addEventListener('periodicsync', e => {
  if (e.tag === 'dc-reminder-check') e.waitUntil(checkAlarms());
});

// ════════════════════════════════════
//  SHOW NOTIFICATION (shared helper)
// ════════════════════════════════════
function fireNotification(title, body, tag) {
  return self.registration.showNotification(title, {
    body,
    tag,
    renotify:            true,
    icon:                './icons/icon-192.png',
    badge:               './icons/icon-192.png',
    vibrate:             [300, 150, 300, 150, 600],
    requireInteraction:  true,
    silent:              false,
    actions: [
      { action: 'taken',  title: '✅ Mark as Taken' },
      { action: 'snooze', title: '⏰ Snooze 10 min'  }
    ],
    data: { tag }
  }).catch(() => {});
}
