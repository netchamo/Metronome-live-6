// Keeps the metronome on the device so it opens without internet.
// Strategy: answer from the saved copy right away, and refresh that copy in the background when online.
const CACHE = 'metronome-v18';
const FILES = [
  './', './index.html', './manifest.json',
  './rubik.woff', './rubik-italic.woff', './assistant.woff',
  './apple-touch-icon.png', './icon-192.png', './icon-512.png', './icon-maskable-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(async cache => {
    const isPage = req.mode === 'navigate';
    const cached = await cache.match(isPage ? './index.html' : req, { ignoreSearch: true });
    const network = fetch(req, { cache: 'no-cache' }).then(res => {
      if (res && res.ok) cache.put(isPage ? './index.html' : req, res.clone());
      return res;
    }).catch(() => null);
    if (cached) { e.waitUntil(network); return cached; }
    return (await network) || new Response('אין חיבור לרשת', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }));
});
