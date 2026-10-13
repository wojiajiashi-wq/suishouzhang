// 离线缓存：页面优先联网取最新版本，没网时用上次缓存的版本；图标等文件直接用缓存。
const CACHE = 'suishouzhang-v8';
const FILES = ['./', './index.html', './manifest.webmanifest', './icon-180.png', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname === 'cdn.jsdelivr.net') {
    // 截图识别组件：下载一次后缓存，之后离线也能用
    e.respondWith(caches.open(CACHE + '-ocr').then((c) => c.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) c.put(req, res.clone());
      return res;
    }))));
    return;
  }
  if (url.origin !== location.origin) return;
  if (url.pathname.endsWith('.json') && !url.pathname.endsWith('manifest.webmanifest')) {
    // config.json 等配置：联网优先，拿到最新的后台配置；没网时用上次的
    e.respondWith(fetch(req, { cache: 'no-store' }).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req)));
    return;
  }
  const isPage = req.mode === 'navigate' || req.url.endsWith('.html') || req.url.endsWith('/');
  if (isPage) {
    e.respondWith(
      fetch(req, { cache: 'no-store' })
        .then((res) => {
          if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put('./index.html', copy)); }
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req)));
});
