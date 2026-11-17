/**
 * öğrenme motorunu tetikleme — yalnız sunucu. Vercel Python fonksiyonu /api/beyin'i
 * CRON_SECRET ile çağırır; anahtar tarayıcıya hiç inmez.
 *
 * - beyinCalistir(): "Beyni güncelle" tuşu bekler ve sonucu gösterir.
 * - beyniArkaplandaGuncelle(): yeni temas / yeni kişi sonrası. Next `after()` ile yanıt
 *   kullanıcıya döndükten SONRA çalışır; temas ekleme hızını bozmaz (CLAUDE.md kural 3).
 */
import { after } from 'next/server'
import { headers } from 'next/headers'

export interface BeyinSonucu {
  hata?: string
  tamam?: boolean
  yeni_kayit?: number
  toplam_kayit?: number
  noron?: number
  yeni_aktif_bag?: number
}

async function adres(): Promise<string | null> {
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host')
  // Yerelde (next dev) Python fonksiyonu yok: `npm run beyin`
  if (!host || /^(localhost|127\.0\.0\.1)/.test(host)) return null
  return `https://${host}/api/beyin`
}

async function cagir(url: string): Promise<BeyinSonucu> {
  const gizli = process.env.CRON_SECRET
  if (!gizli) return { hata: 'CRON_SECRET tanımlı değil.' }
  try {
    const yanit = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${gizli}` },
      cache: 'no-store',
    })
    const govde = (await yanit.json().catch(() => ({}))) as BeyinSonucu
    if (!yanit.ok || !govde.tamam) return { hata: govde.hata ?? `Beyin güncellenemedi (HTTP ${yanit.status}).` }
    return govde
  } catch (e) {
    console.error('[beyin] servis çağrısı', e)
    return { hata: 'Beyin servisine ulaşılamadı. Biraz sonra tekrar dene; kayıtların etkilenmedi.' }
  }
}

export async function beyinCalistir(): Promise<BeyinSonucu> {
  const url = await adres()
  if (!url) return { hata: 'Yerelde bu tuş çalışmaz; terminalde `npm run beyin` çalıştır.' }
  return cagir(url)
}

/** Yanıttan sonra, sessizce. Hata olursa yalnız sunucu loguna düşer; ertesi sabahki cron telafi eder. */
export async function beyniArkaplandaGuncelle(): Promise<void> {
  const url = await adres()
  if (!url) return
  after(async () => {
    const s = await cagir(url)
    if (s.hata) console.error('[beyin] arka plan güncellemesi başarısız:', s.hata)
  })
}
