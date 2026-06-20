// ================================================================
// LocaSyn — service-worker.js
// PWA Service Worker — Cache-First pour assets, Network-First pour API
// ================================================================

const CACHE_NAME = 'locasyn-v1';
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 jours

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/assets/css/main.css',
  '/assets/css/components.css',
  '/assets/css/screens.css',
  '/assets/js/app.js',
  '/assets/js/auth.js',
  '/assets/js/router.js',
  '/assets/js/store.js',
  '/assets/js/utils.js',
  '/assets/js/supabase.js',
  '/assets/js/modules/marketplace.js',
  '/assets/js/modules/listing.js',
  '/assets/js/modules/messaging.js',
  '/assets/js/modules/publish.js',
  '/assets/js/modules/payment.js',
  '/assets/js/modules/profile.js',
  '/assets/js/modules/loyers.js',
  '/assets/js/modules/admin.js',
  '/screens/home.html',
  '/screens/auth.html',
  '/screens/onboarding.html',
  '/screens/search.html',
  '/screens/listing-detail.html',
  '/screens/messages.html',
  '/screens/chat.html',
  '/screens/publish.html',
  '/screens/profile.html',
  '/screens/favoris.html',
  '/screens/loyers.html',
  '/screens/mes-annonces.html',
  '/screens/contrats.html',
  '/screens/boost.html',
  '/screens/payment-caution.html',
  '/screens/payment-loyer.html',
  '/screens/admin.html',
  '/manifest.json',
];

// ----------------------------------------------------------------
// Installation — pré-cache des assets statiques
// ----------------------------------------------------------------
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Certains assets non mis en cache:', err);
      });
    })
  );
  self.skipWaiting();
});

// ----------------------------------------------------------------
// Activation — nettoyage anciens caches
// ----------------------------------------------------------------
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ----------------------------------------------------------------
// Fetch — stratégie hybride
// ----------------------------------------------------------------
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Ignorer les requêtes non-GET
  if (event.request.method !== 'GET') return;

  // Ignorer Supabase API, KKiaPay, WhatsApp, Gemini — toujours réseau
  if (
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('kkiapay') ||
    url.hostname.includes('graph.facebook.com') ||
    url.hostname.includes('generativelanguage.googleapis.com') ||
    url.hostname.includes('esm.sh')
  ) {
    return;
  }

  // Leaflet — cache-first
  if (url.hostname.includes('unpkg.com') || url.hostname.includes('tile.openstreetmap.org')) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  // Google Fonts — cache-first
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  // Assets statiques — stale-while-revalidate
  if (
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/screens/') ||
    url.pathname === '/' ||
    url.pathname === '/index.html' ||
    url.pathname === '/manifest.json'
  ) {
    event.respondWith(staleWhileRevalidate(event.request));
    return;
  }
});

// ----------------------------------------------------------------
// Stratégies de cache
// ----------------------------------------------------------------
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Hors ligne', { status: 503 });
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => null);

  return cached || await fetchPromise || new Response('Hors ligne', { status: 503 });
}

// ----------------------------------------------------------------
// Message depuis l'app (force refresh du cache)
// ----------------------------------------------------------------
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data?.type === 'CLEAR_CACHE') {
    caches.delete(CACHE_NAME);
  }
});
