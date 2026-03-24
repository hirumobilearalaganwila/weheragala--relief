// Service Worker for වෙහෙරගල මහා විද්‍යාලය Relief Manager
// Version - update this to force cache refresh
const CACHE_VERSION = 'relief-manager-v1';

// Assets to cache on install (app shell)
const CACHE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=Noto+Sans+Sinhala:wght@400;600;700&family=Montserrat:wght@400;600;700;800;900&family=JetBrains+Mono:wght@400;600&display=swap'
];

// Install event - cache app shell
self.addEventListener('install', event => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache => {
      console.log('[SW] Caching app shell');
      // Cache each asset individually, don't fail if one misses
      return Promise.allSettled(
        CACHE_ASSETS.map(url =>
          cache.add(url).catch(err => console.warn('[SW] Could not cache:', url, err))
        )
      );
    })
  );
  self.skipWaiting();
});

// Activate event - clean old caches
self.addEventListener('activate', event => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_VERSION)
          .map(key => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      )
    )
  );
  self.clients.claim();
});

// Fetch event - network first for Firebase/API, cache first for app shell
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Always go network-first for Firebase, Google APIs, and Anthropic API
  if (
    url.hostname.includes('firebase') ||
    url.hostname.includes('firestore') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('gstatic.com') ||
    url.hostname.includes('anthropic.com') ||
    url.hostname.includes('firebaseapp.com')
  ) {
    event.respondWith(
      fetch(event.request).catch(() => {
        // Offline fallback for API calls
        return new Response(JSON.stringify({ error: 'Offline' }), {
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // Cache-first strategy for app shell (HTML, CSS, fonts)
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // Cache valid GET responses
        if (
          event.request.method === 'GET' &&
          response.status === 200
        ) {
          const clone = response.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // Fallback to index.html if offline
        if (event.request.destination === 'document') {
          return caches.match('./index.html');
        }
      });
    })
  );
});

// Handle messages from app
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});
