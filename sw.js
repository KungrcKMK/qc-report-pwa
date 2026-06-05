/* Service Worker - offline shell (cache-first สำหรับ static, network สำหรับ API) */
var CACHE = 'qc-shell-v1';
var SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) { return c.addAll(SHELL); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var url = new URL(e.request.url);

  // API calls (Apps Script) → ผ่านเน็ตตรงๆ ไม่ cache ข้อมูล dynamic
  if (url.hostname.indexOf('script.google') !== -1 ||
      url.hostname.indexOf('googleusercontent') !== -1) {
    return; // ปล่อยให้ browser fetch ตามปกติ
  }

  // static shell → cache-first, fallback network, แล้ว cache เพิ่ม
  e.respondWith(
    caches.match(e.request).then(function (cached) {
      if (cached) return cached;
      return fetch(e.request).then(function (res) {
        if (e.request.method === 'GET' && res && res.status === 200) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
        }
        return res;
      }).catch(function () {
        // offline + ไม่มีใน cache → ถ้าเป็นหน้า ให้ fallback index
        if (e.request.mode === 'navigate') return caches.match('./index.html');
      });
    })
  );
});
