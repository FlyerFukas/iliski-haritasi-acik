'use client'

import { useEffect } from 'react'

/**
 * Service worker kaydı + kurulum isteminin yakalanması.
 *
 * İkisi de [slug] layout'unda, yani GİRİŞ EKRANI DAHİL her sayfada çalışır:
 * Chrome "uygulama olarak yükle" kararını o an bakılan sayfaya göre verir ve
 * uygulama ilk açıldığında görülen sayfa giriş ekranıdır.
 *
 * `beforeinstallprompt` olayı sayfa açılır açılmaz, Ayarlar ekranı daha
 * çizilmeden tetiklenebilir. Kaçırmamak için burada yakalayıp window üzerinde
 * saklıyoruz; Ayarlar'daki düğme oradan alıyor.
 */

declare global {
  interface Window {
    __ihKurulumIstemi?: Event & { prompt: () => Promise<void> }
  }
}

export const KURULABILIR_OLAY = 'ih-kurulabilir'

export default function ServiceWorkerKaydi() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
        // sessiz geç: yükleme özelliği olmasa da uygulama çalışır
      })
    }

    const yakala = (olay: Event) => {
      olay.preventDefault() // Chrome'un kendi çubuğunu bastır, düğmeyi biz gösterelim
      window.__ihKurulumIstemi = olay as Window['__ihKurulumIstemi']
      window.dispatchEvent(new CustomEvent(KURULABILIR_OLAY))
    }

    window.addEventListener('beforeinstallprompt', yakala)
    return () => window.removeEventListener('beforeinstallprompt', yakala)
  }, [])

  return null
}
