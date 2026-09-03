/* Service worker do Calendário Logística.
 * Estratégia: o "shell" (index, manifest, ícones, fotos) fica em cache pra abrir offline;
 * o index.html é sempre buscado na rede primeiro (o Render serve com no-cache), com o
 * cache como fallback. Requisições do Firebase e do Open-Meteo passam direto — o app
 * já tem o próprio cache no localStorage e o Firestore tem a própria fila offline. */
const CACHE = 'logistica-cal-v2';   // v2: paleta nova (logo e icones mudaram)
const SHELL = [
  './', './index.html', './manifest.json', './icon-192.svg', './icon-512.svg', './logo.png',
  './fotos/alberto.jpg', './fotos/ludmylla.jpg', './fotos/rosilene.jpg'
];
// SDK e fontes: cache-first, porque sem o SDK o app nem carrega offline.
const CDN_HOSTS = ['www.gstatic.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => Promise.all(
      // addAll falharia tudo se um único arquivo faltasse; aqui cada um falha sozinho
      SHELL.map(u => c.add(u).catch(() => null))
    )).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (CDN_HOSTS.includes(url.host)) {
    e.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => null);
        return res;
      }))
    );
    return;
  }

  if (url.origin !== self.location.origin) return; // Firebase, Open-Meteo etc.

  if (req.mode === 'navigate' || url.pathname.endsWith('/index.html')) {
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put('./index.html', copy)).catch(() => null);
        return res;
      }).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // demais arquivos locais: stale-while-revalidate
  e.respondWith(
    caches.match(req).then(hit => {
      const net = fetch(req).then(res => {
        if (res.ok) caches.open(CACHE).then(c => c.put(req, res.clone())).catch(() => null);
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});
