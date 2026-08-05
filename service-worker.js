const VERSION = '47';
const CACHE_PREFIX = 'tracker-personale';
const PRECACHE = `${CACHE_PREFIX}-precache-v${VERSION}`;
const RUNTIME = `${CACHE_PREFIX}-runtime-v${VERSION}`;

const APP_SHELL = [
  './',
  './index.html',
  './giornata.html',
  './sonno.html',
  './cibo-acqua.html',
  './lettura.html',
  './tetr-emotion.html',
  './statistiche.html',
  './archivio.html',
  './impostazioni.html',
  './offline.html',
  './styles.css?v=46',
  './mobile.css?v=47',
  './pwa.css?v=46',
  './tracker-store.js?v=46',
  './app.js?v=46',
  './pwa.js?v=47',
  './manifest.json?v=46',
  './favicon.png',
  './apple-touch-icon.png',
  './apple-touch-icon-v45.png',
  './icons/app-screen-icon-192-v45.png',
  './icons/app-screen-icon-512-v45.png',
  './icons/app-screen-icon-maskable-192-v45.png',
  './icons/app-screen-icon-maskable-512-v45.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
  './assets/hero-room.png?v=47'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(PRECACHE).then((cache) =>
      Promise.allSettled(APP_SHELL.map((asset) => cache.add(asset)))
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter((key) =>
              key.startsWith(CACHE_PREFIX) &&
              ![PRECACHE, RUNTIME].includes(key)
            )
            .map((key) => caches.delete(key))
        )
      ),
      self.registration.navigationPreload
        ? self.registration.navigationPreload.enable()
        : Promise.resolve(),
      self.clients.claim()
    ])
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

function canCache(response) {
  return Boolean(
    response &&
    response.status === 200 &&
    (response.type === 'basic' || response.type === 'default')
  );
}

async function navigationResponse(event) {
  const request = event.request;
  const runtimeCache = await caches.open(RUNTIME);

  try {
    const preload = await event.preloadResponse;
    if (preload) {
      if (canCache(preload)) runtimeCache.put(request, preload.clone());
      return preload;
    }

    const response = await fetch(request);
    if (canCache(response)) runtimeCache.put(request, response.clone());
    return response;
  } catch (error) {
    const cachedPage = await caches.match(request, { ignoreSearch: true });
    if (cachedPage) return cachedPage;

    const offline = await caches.match('./offline.html');
    if (offline) return offline;

    throw error;
  }
}

async function staticResponse(request) {
  const cached = await caches.match(request);

  const networkPromise = fetch(request)
    .then(async (response) => {
      if (canCache(response)) {
        const runtimeCache = await caches.open(RUNTIME);
        runtimeCache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  if (cached) return cached;

  const network = await networkPromise;
  return network || Response.error();
}

self.addEventListener('fetch', (event) => {
  const request = event.request;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Google Sheets, meteo e risorse esterne restano gestiti dalla rete.
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(navigationResponse(event));
    return;
  }

  event.respondWith(staticResponse(request));
});
