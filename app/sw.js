// sw.js — basic offline cache for Coffigo
// Cache-first for our own assets, network-first for everything else.

const CACHE = 'coffigo-v10';
const ASSETS = [
  './',
  './index.html',
  './touch-selector.jsx',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon.svg',
  './apple-touch-icon.png',
  // CDN deps — cached on first load
  'https://unpkg.com/react@18.3.1/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js',
  'https://unpkg.com/@babel/standalone@7.29.0/babel.min.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then(cache =>
      // Use addAll best-effort — don't fail install if one CDN URL flakes
      Promise.all(ASSETS.map(a => cache.add(a).catch(() => null)))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  // Analytics: always hit the network, never cache (fails silently when offline).
  const host = new URL(req.url).hostname;
  if (/(^|\.)(google-analytics\.com|googletagmanager\.com|analytics\.google\.com)$/.test(host)) {
    return;
  }
  e.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(res => {
        // Cache successful responses to grow the cache (incl. font files)
        if (res && res.status === 200 && res.type !== 'opaqueredirect') {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(req, clone)).catch(() => {});
        }
        return res;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
