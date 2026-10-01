/**
 * ETHER — service worker (PWA)
 * Met en cache la coque de l'app pour l'installation et le hors-ligne.
 * Ne met JAMAIS en cache /api/* ni une requete authentifiee : les reponses
 * de l'API (conversations, jetons, quotas) restent toujours fraiches et privees.
 * Changer CACHE_VERSION a chaque modification de la liste SHELL.
 * Les URL sont canoniques : Cloudflare redirige /index.html vers / et
 * /offline.html vers /offline, et une reponse redirigee ne peut pas servir
 * une navigation.
 */
const CACHE_VERSION = 'v1';
const CACHE_NAME = 'ether-shell-' + CACHE_VERSION;
const OFFLINE_URL = '/offline';
const SHELL = [
  '/',
  '/style.css',
  '/marked.min.js',
  '/manifest.webmanifest',
  OFFLINE_URL,
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/renderer/platform-web.js',
  '/renderer/core.js',
  '/renderer/memory.js',
  '/renderer/engine.js',
  '/renderer/ui.js',
  '/renderer/skill-creator.js',
  '/renderer/docgen.js',
  '/renderer/app-main.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL.map(u => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys
        .filter(k => k.startsWith('ether-') && k !== CACHE_NAME)
        .map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Ce que le service worker a le droit de toucher : GET de la meme origine,
// hors API, sans en-tete d'authentification.
function isCacheable(request, url) {
  if (request.method !== 'GET') return false;
  if (url.origin !== self.location.origin) return false;
  if (url.pathname.startsWith('/api/')) return false;
  if (request.headers.has('Authorization')) return false;
  return true;
}

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  // Pas de respondWith : le navigateur traite la requete normalement.
  if (!isCacheable(request, url)) return;

  // Pages : reseau d'abord, page hors-ligne claire en secours.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }

  // Fichiers de la coque : reseau d'abord (jamais de JS perime face a un
  // index.html neuf), copie mise a jour, cache en secours hors ligne.
  if (SHELL.includes(url.pathname)) {
    event.respondWith(
      fetch(request).then(res => {
        if (res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(url.pathname, copy));
        }
        return res;
      }).catch(() => caches.match(url.pathname).then(r => r || Response.error()))
    );
  }
});
