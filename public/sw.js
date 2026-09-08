const CACHE_NAME = 'gairo-finances-cache-v4';
const SHELL = ['/manifest.json', '/icon.svg', '/brand/sifran-logo.svg', '/brand/sifran-logo-dark.svg'];
self.addEventListener('install', event => { event.waitUntil(self.skipWaiting()); });
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('gairo-finances-cache-') && key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request; const url = new URL(request.url);
  // Cache only generic static assets. Never navigation, auth, API or documents.
  if (request.method !== 'GET' || request.mode === 'navigate' || url.origin !== self.location.origin || (!url.pathname.startsWith('/assets/') && !SHELL.includes(url.pathname))) return;
  event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => {
    if (response.ok && response.type === 'basic' && !response.redirected) event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone())));
    return response;
  })));
});
