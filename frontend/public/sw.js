/* eslint-disable no-restricted-globals */

const CACHE_NAME = 'rightway-cache-v1';
const OFFLINE_URL = '/offline.html';

// Cache critical assets on install
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([OFFLINE_URL]).catch(() => {});
    })
  );
  self.skipWaiting();
});

// Respond to SKIP_WAITING message from PWAUpdatePrompt
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Clean old caches on activate
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Network-first for pages, stale-while-revalidate for assets
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (event.request.url.includes('/api/')) return;
  
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request).then((cached) => {
          return cached || caches.match(OFFLINE_URL);
        });
      })
  );
});

// ─── PUSH NOTIFICATIONS ───
self.addEventListener('push', (event) => {
  let data = { title: 'RightWay Centre', body: 'New notification', tag: 'general', url: '/' };
  
  try {
    if (event.data) {
      data = { ...data, ...event.data.json() };
    }
  } catch (e) {
    if (event.data) {
      data.body = event.data.text();
    }
  }

  const isEmergency = data.tag === 'emergency' || data.tag === 'sick_bay_emergency';

  const options = {
    body: data.body,
    icon: '/favicon.svg',
    badge: '/favicon.png',
    tag: data.tag || 'general',
    renotify: true,
    requireInteraction: isEmergency,
    silent: false,
    vibrate: isEmergency
      ? [500, 200, 500, 200, 500, 200, 500]  // Urgent long pattern
      : [200, 100, 200, 100, 200],             // Standard bell-like pattern
    data: { url: data.url || '/' },
    actions: isEmergency
      ? [{ action: 'view', title: 'View Now' }]
      : [{ action: 'view', title: 'Open' }],
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options).then(() => {
      // Play alarm bell tone via all open clients
      return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: 'PLAY_NOTIFICATION_SOUND',
            isEmergency: isEmergency,
            tag: data.tag,
          });
        });
      });
    })
  );
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const url = event.notification.data?.url || '/';
  
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus existing tab if open
      for (const client of clientList) {
        if (client.url.includes(self.registration.scope) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      // Open new tab
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })
  );
});
