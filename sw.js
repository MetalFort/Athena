/* =========================================================
   ATENA — sw.js (Service Worker)
   Ele guarda uma cópia dos arquivos do app no aparelho,
   para o app abrir mesmo sem internet.

   IMPORTANTE: sempre que você mudar algum arquivo do app,
   aumente o número da versão abaixo (v1 -> v2 -> v3...).
   Assim o celular baixa a versão nova.
   ========================================================= */

const CACHE = 'atena-v23';

// Arquivos que ficam salvos para uso offline
const FILES = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

// 1) Instalação: salva os arquivos no cache
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)));
  self.skipWaiting();
});

// 2) Ativação: apaga caches de versões antigas
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// 3) Busca: tenta a internet primeiro; se falhar (offline), usa o cache.
//    Assim você sempre vê a versão mais nova quando estiver online.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  // Só cuida dos arquivos do próprio app e da biblioteca do Firebase.
  // A conversa com o banco de dados (Firestore/login) passa direto.
  const url = event.request.url;
  if (!url.startsWith(self.location.origin) && !url.includes('gstatic.com/firebasejs')) return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// 4) Tocar numa notificação abre (ou traz para frente) o app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      if (list.length) return list[0].focus();
      return self.clients.openWindow('./');
    })
  );
});
