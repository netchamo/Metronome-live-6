// Keeps the metronome on the device so it opens without internet.
// The saved copy answers first; when online, a fresh copy is fetched in the background and saved,
// but only if it really is the metronome (a Wi-Fi login page or an error page is never saved over it).
const CACHE = 'metronome-v23';
const MARK = 'six-tempo-metronome';            // text that only the real app page contains
const FILES = [
  './index.html', './manifest.json',
  './rubik.woff', './rubik-italic.woff', './assistant.woff',
  './apple-touch-icon.png', './icon-192.png', './icon-512.png', './icon-maskable-512.png'
];

async function fetchGood(url, isPage){
  const res = await fetch(url, { cache: 'reload' });
  if (!res || !res.ok || res.type !== 'basic' || res.redirected) throw new Error('bad response');
  if (isPage){
    const text = await res.clone().text();
    if (!text.includes(MARK)) throw new Error('not the app');
  }
  return res;
}

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    for (const f of FILES){
      const res = await fetchGood(f, f.endsWith('index.html'));
      await cache.put(f, res);
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    // remove older copies only now that the new one is complete
    await Promise.all(keys.filter(k => k.startsWith('metronome-') && k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

async function fromAnyCache(key){
  const own = await (await caches.open(CACHE)).match(key, { ignoreSearch: true });
  return own || caches.match(key, { ignoreSearch: true });   // falls back to an older saved copy, never to nothing
}

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  const isPage = req.mode === 'navigate';
  const key = isPage ? './index.html' : req;
  e.respondWith((async () => {
    const cached = await fromAnyCache(key);
    const refresh = (async () => {
      try {
        const res = await fetchGood(req.url, isPage);
        await (await caches.open(CACHE)).put(key, res.clone());
        return res;
      } catch(_) { return null; }
    })();
    if (cached){ e.waitUntil(refresh); return cached; }
    const fresh = await refresh;
    return fresh || new Response('המטרונום עוד לא נשמר במכשיר. פתח אותו פעם אחת כשיש אינטרנט.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  })());
});
