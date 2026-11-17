'use client'

import { useEffect, useState } from 'react'
import { KURULABILIR_OLAY } from '../../ServiceWorkerKaydi'

/**
 * "Uygulama olarak yükle" düğmesi.
 *
 * Chrome kurulum iznini `beforeinstallprompt` olayıyla verir. Olay gelmişse
 * düğme gerçekten kurar. GELMEMİŞSE düğme kuramaz — o yüzden çalışmayan bir
 * düğme göstermek yerine o cihaza uygun elle kurulum adımlarını yazıyoruz.
 * iOS'ta bu olay hiç tetiklenmez; Safari'de "Ana Ekrana Ekle" tek yoldur.
 */

type Durum = 'bilinmiyor' | 'kurulabilir' | 'kurulu' | 'elle'

export default function KurulumDugmesi() {
  const [durum, setDurum] = useState<Durum>('bilinmiyor')
  const [ios, setIos] = useState(false)
  const [bekliyor, setBekliyor] = useState(false)
  const [sonuc, setSonuc] = useState<string | null>(null)

  useEffect(() => {
    const kuruluMu =
      window.matchMedia('(display-mode: standalone)').matches ||
      // iOS Safari kendi bayrağını kullanır
      (navigator as unknown as { standalone?: boolean }).standalone === true

    const iosMu = /iphone|ipad|ipod/i.test(navigator.userAgent)
    setIos(iosMu)

    if (kuruluMu) {
      setDurum('kurulu')
      return
    }

    if (window.__ihKurulumIstemi) {
      setDurum('kurulabilir')
    } else {
      // Olay henüz gelmemiş olabilir; bir süre bekleyip elle yönergeye düş
      setDurum('bilinmiyor')
      const zamanlayici = setTimeout(() => {
        setDurum((d) => (d === 'bilinmiyor' ? 'elle' : d))
      }, 2500)
      const geldi = () => {
        clearTimeout(zamanlayici)
        setDurum('kurulabilir')
      }
      window.addEventListener(KURULABILIR_OLAY, geldi)
      return () => {
        clearTimeout(zamanlayici)
        window.removeEventListener(KURULABILIR_OLAY, geldi)
      }
    }
  }, [])

  useEffect(() => {
    const kuruldu = () => {
      setDurum('kurulu')
      setSonuc(null)
    }
    window.addEventListener('appinstalled', kuruldu)
    return () => window.removeEventListener('appinstalled', kuruldu)
  }, [])

  const kur = async () => {
    const istem = window.__ihKurulumIstemi
    if (!istem) {
      setDurum('elle')
      return
    }
    setBekliyor(true)
    try {
      await istem.prompt()
      const { outcome } = await (istem as unknown as {
        userChoice: Promise<{ outcome: string }>
      }).userChoice
      if (outcome === 'accepted') setSonuc('Kuruluyor — ana ekranına bak.')
      else setSonuc('Kurulum iptal edildi. İstediğin zaman tekrar deneyebilirsin.')
    } catch {
      setSonuc('Kurulum başlatılamadı. Aşağıdaki adımları elle uygulayabilirsin.')
      setDurum('elle')
    } finally {
      window.__ihKurulumIstemi = undefined
      setBekliyor(false)
    }
  }

  return (
    <section className="kart yigin">
      <div className="kart-baslik">
        <h2>Telefona / masaüstüne kur</h2>
      </div>

      {durum === 'kurulu' ? (
        <p className="rozet rozet-GUNCEL" style={{ padding: '10px 14px' }}>
          ✓ Uygulama olarak kurulu — şu an uygulama penceresinde çalışıyorsun.
        </p>
      ) : null}

      {durum === 'kurulabilir' ? (
        <>
          <p className="soluk" style={{ margin: 0 }}>
            Ana ekranına yerleşir, tarayıcı çubuğu olmadan açılır.
          </p>
          <button
            type="button"
            className="btn btn-birincil btn-genis"
            onClick={kur}
            disabled={bekliyor}
            style={{ minHeight: 54, fontSize: '1.05rem' }}
          >
            {bekliyor ? 'Kuruluyor…' : '📲 Uygulama olarak yükle'}
          </button>
        </>
      ) : null}

      {durum === 'bilinmiyor' ? (
        <p className="soluk" style={{ margin: 0 }}>
          Kurulum durumu kontrol ediliyor…
        </p>
      ) : null}

      {durum === 'elle' ? (
        <>
          <p style={{ margin: 0 }}>
            Bu tarayıcı tek dokunuşla kurmaya izin vermiyor. Elle kurmak birkaç
            saniye:
          </p>
          {ios ? (
            <ol className="yigin" style={{ gap: 6, paddingLeft: 20, margin: 0 }}>
              <li>Alttaki <strong>Paylaş</strong> düğmesine dokun</li>
              <li>
                <strong>Ana Ekrana Ekle</strong> seçeneğini seç
              </li>
              <li>Sağ üstten <strong>Ekle</strong></li>
            </ol>
          ) : (
            <ol className="yigin" style={{ gap: 6, paddingLeft: 20, margin: 0 }}>
              <li>
                Sağ üstteki <strong>⋮</strong> menüsünü aç
              </li>
              <li>
                <strong>Uygulamayı yükle</strong> ya da <strong>Ana ekrana ekle</strong>
              </li>
              <li>Görünmüyorsa sayfayı bir kez yenileyip tekrar bak</li>
            </ol>
          )}
          <p className="soluk" style={{ margin: 0 }}>
            iOS&apos;ta Safari dışındaki tarayıcılar ana ekrana ekleyemez.
          </p>
        </>
      ) : null}

      {sonuc ? (
        <p className="rozet rozet-notr" role="status" style={{ padding: '8px 12px' }}>
          {sonuc}
        </p>
      ) : null}
    </section>
  )
}
