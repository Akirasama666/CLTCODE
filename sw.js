/* CLT Code — service worker: deixa o app abrir mesmo sem internet. */
const CACHE = 'cltcode-v1';
const ESSENCIAIS = ['/', '/index.html', '/app.css', '/app.js', '/manifest.json', '/icon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ESSENCIAIS))
    .then(() => self.skipWaiting()).catch(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.pathname.startsWith('/api/') || url.hostname.endsWith('supabase.co')) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req)
      .then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put('/index.html', c)); return r; })
      .catch(() => caches.match('/index.html')));
    return;
  }
  e.respondWith(caches.match(req).then(hit => {
    const rede = fetch(req).then(r => {
      if (r && r.status === 200 && (url.origin === location.origin || url.hostname.includes('fonts.') || url.hostname.includes('cdn'))) {
        const c = r.clone(); caches.open(CACHE).then(x => x.put(req, c));
      }
      return r;
    }).catch(() => hit);
    return hit || rede;
  }));
});
