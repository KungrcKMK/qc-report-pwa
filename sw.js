/* Service Worker - QCControl
   navigation/HTML = network-first (อัปเดตทันทีเมื่อมีเน็ต, ใช้ cache เมื่อ offline)
   static อื่นๆ = cache-first */
var CACHE = 'qc-shell-v67';
var NAV_TIMEOUT_MS = 4000;
var SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js'
];

/* ตัวใหม่จะ "รอคิว" ไว้ ไม่แย่งทำงานเอง — หน้าเว็บจะขึ้นป๊อปอัพให้ผู้ใช้กด "อัปเดต"
   แล้วส่ง SKIP_WAITING มาบอกให้สลับตัว (ครั้งแรกสุดที่ยังไม่มีตัวคุมอยู่ จะ activate ทันทีอยู่แล้ว) */
self.addEventListener('install', function (e) {
  // ไฟล์ของแอปเองต้องครบ · สคริปต์ QR จาก CDN โหลดไม่ได้ก็ยังติดตั้งได้ (ใช้แค่แท็บแชร์)
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      var own = SHELL.filter(function (u) { return u.indexOf('http') !== 0; });
      var cdn = SHELL.filter(function (u) { return u.indexOf('http') === 0; });
      return c.addAll(own).then(function () {
        return Promise.all(cdn.map(function (u) { return c.add(u).catch(function () {}); }));
      });
    })
  );
});

self.addEventListener('message', function (e) {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
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

  // API (Cloudflare Worker / Apps Script เดิม) → เน็ตตรงๆ ไม่ cache ข้อมูล dynamic
  if (/\.workers\.dev$/.test(url.hostname) ||
      url.hostname.indexOf('script.google') !== -1 ||
      url.hostname.indexOf('googleusercontent') !== -1) {
    return;
  }

  // หน้าเว็บ/HTML → network-first (ได้ของใหม่เสมอเมื่อออนไลน์)
  // · เก็บลงเครื่องเฉพาะหน้าที่โหลดสำเร็จ (200) — เดิมเก็บหน้า error ทับหน้าแอปได้
  // · เน็ตช้า/ค้างเกิน 4 วิ → เปิดหน้าที่เก็บไว้ก่อน (ของใหม่โหลดต่อเบื้องหลังแล้วเก็บไว้รอบหน้า)
  if (e.request.mode === 'navigate' || e.request.destination === 'document') {
    var net = fetch(e.request).then(function (res) {
      if (res && res.ok) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put('./index.html', copy); });
      }
      return res;
    });
    var cached = function () { return caches.match('./index.html').then(function (m) { return m || caches.match(e.request); }); };
    e.respondWith(new Promise(function (resolve) {
      var done = false;
      var finish = function (r) { if (!done && r) { done = true; resolve(r); } };
      var timer = setTimeout(function () { cached().then(function (m) { if (m) finish(m); }); }, NAV_TIMEOUT_MS);
      net.then(function (res) {
        clearTimeout(timer);
        if (res.ok) return finish(res);
        cached().then(function (m) { finish(m || res); });   // หน้า error → ใช้หน้าที่เก็บไว้ถ้ามี
      }).catch(function () {
        clearTimeout(timer);
        cached().then(function (m) { finish(m || Response.error()); });
      });
    }));
    e.waitUntil(net.catch(function () {}));
    return;
  }

  // static อื่นๆ → cache-first
  e.respondWith(
    caches.match(e.request).then(function (cached) {
      return cached || fetch(e.request).then(function (res) {
        if (e.request.method === 'GET' && res && res.status === 200) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
        }
        return res;
      });
    })
  );
});
