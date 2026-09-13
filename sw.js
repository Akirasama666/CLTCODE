/* CLT Code — service worker
   Objetivo: abrir offline, mas nunca servir uma versão velha do app. */
const CACHE = 'cltcode-v2';
const ESSENCIAIS = ['/', '/index.html', '/app.css', '/app.js', '/manifest.json', '/icon.svg'];
/* arquivos do próprio app: rede primeiro, para a atualização chegar na hora */
const SEMPRE_FRESCO = ['/index.html', '/app.css', '/app.js', '/manifest.json'];

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

  /* nunca guardar chamadas de dados */
  if (url.pathname.startsWith('/api/') || url.hostname.endsWith('supabase.co')) return;

  const doApp = url.origin === location.origin &&
    (req.mode === 'navigate' || SEMPRE_FRESCO.includes(url.pathname));

  if (doApp) {
    /* rede primeiro: sempre a versão publicada mais nova; cache só se estiver sem internet */
    e.respondWith(
      fetch(req).then(r => {
        const c = r.clone();
        caches.open(CACHE).then(x => x.put(req.mode === 'navigate' ? '/index.html' : req, c));
        return r;
      }).catch(() => caches.match(req).then(hit => hit || caches.match('/index.html')))
    );
    return;
  }

  /* resto (fontes, bibliotecas): cache primeiro, atualiza em segundo plano */
  e.respondWith(caches.match(req).then(hit => {
    const rede = fetch(req).then(r => {
      if (r && r.status === 200 &&
          (url.origin === location.origin || url.hostname.includes('fonts.') || url.hostname.includes('cdn'))) {
        const c = r.clone(); caches.open(CACHE).then(x => x.put(req, c));
      }
      return r;
    }).catch(() => hit);
    return hit || rede;
  }));
});
