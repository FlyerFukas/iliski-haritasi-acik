// İlişki Haritası — service worker
//
// Tek işi Chrome'un "uygulama olarak yükle" ölçütünü karşılamak: yüklenebilir
// bir PWA'nın fetch olayını dinleyen bir service worker'ı olmalı.
//
// BİLEREK ÖNBELLEĞE ALMIYOR. Uygulamanın gösterdiği her şey (kim gecikti,
// son temas ne zaman) canlı veriye bağlı; bayat bir sayfa göstermek yanlış
// karar aldırır. O yüzden istekler olduğu gibi ağa gider; ağ yoksa Türkçe
// bir "çevrimdışısın" sayfası döner.

const SURUM = 'iliski-haritasi-v1'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (olay) => {
  // Eski sürümlerden kalan önbellek varsa temizle
  olay.waitUntil(
    caches
      .keys()
      .then((adlar) => Promise.all(adlar.filter((a) => a !== SURUM).map((a) => caches.delete(a))))
      .then(() => self.clients.claim()),
  )
})

const CEVRIMDISI = `<!doctype html>
<html lang="tr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Çevrimdışı</title>
<style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
       background:#0f1216;color:#e7eaee;font-family:system-ui,sans-serif;text-align:center;padding:24px}
  p{color:#9aa4b0}
  button{margin-top:16px;padding:12px 20px;border-radius:10px;border:1px solid #2c333c;
         background:#171b21;color:#e7eaee;font:inherit;font-weight:600}
</style></head>
<body><div>
  <h1>Bağlantı yok</h1>
  <p>İlişki Haritası verilerini canlı okur, çevrimdışı çalışmaz.</p>
  <button onclick="location.reload()">Tekrar dene</button>
</div></body></html>`

self.addEventListener('fetch', (olay) => {
  if (olay.request.method !== 'GET') return

  olay.respondWith(
    fetch(olay.request).catch(() => {
      if (olay.request.mode === 'navigate') {
        return new Response(CEVRIMDISI, {
          status: 503,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        })
      }
      return Response.error()
    }),
  )
})
