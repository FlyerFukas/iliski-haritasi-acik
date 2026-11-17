/**
 * K-02: LinkedIn aktarımlarının veritabanına yazılması (yalnızca sunucu).
 *
 * Kurallar (KARARLAR K-02 kabul kriterleri):
 *  - Dolu bir alan, kullanıcı o çakışmayı açıkça seçmedikçe EZİLMEZ.
 *  - Her yazılan alanın eski değeri ve kaynağı `degisiklik_gecmisi`'ne gider.
 *  - Geçmiş kayıtları `not` alanında "kaynak: ..." taşır; aynısı varsa atlanır.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { linkedinNormalize } from './linkedin'
import { AKTARILAN_ALANLAR, type AktarilanAlan } from './linkedin-aktar'
import { alanAnahtari, kurumAnahtari, KURUM_TURLERI, type KurumTuru } from './ortak-nokta'
import { anahtar } from './turkce'
import { beklenmeyenHata } from './hata-metni'

export type Kaynak = 'LinkedIn PDF' | 'LinkedIn CSV'

export interface AlanSecimi {
  alan: AktarilanAlan
  yeni: string
  /** Kullanıcı çakışmada "ez" dedi mi? */
  ez: boolean
}

export interface GecmisSecimi {
  kisiId: string
  kurum: string
  tur: KurumTuru
  alan: string | null
  basYil: number | null
  bitYil: number | null
  guncel: boolean
}

export interface YazimSonucu {
  yazilanAlan: number
  atlananAlan: number
  eklenenGecmis: number
  atlananGecmis: number
  uyarilar: string[]
}

export function bosSonuc(): YazimSonucu {
  return { yazilanAlan: 0, atlananAlan: 0, eklenenGecmis: 0, atlananGecmis: 0, uyarilar: [] }
}

const yil = (y: unknown) => (Number.isInteger(y) && (y as number) >= 1900 && (y as number) <= 2100 ? (y as number) : null)

/** Bir kişinin alanlarını yaz. `linkedinSahipleri`: kimlik → kişi id (mükerrer kontrolü için). */
export async function alanlariYaz(
  db: SupabaseClient,
  kisiId: string,
  secimler: AlanSecimi[],
  kaynak: Kaynak,
  linkedinSahipleri: Map<string, string>,
  sonuc: YazimSonucu,
): Promise<void> {
  if (secimler.length === 0) return
  const { data: kisi, error } = await db.from('kisiler').select('*').eq('id', kisiId).maybeSingle()
  if (error || !kisi) {
    sonuc.uyarilar.push(`Kişi okunamadı (${kisiId}).`)
    return
  }

  const guncelleme: Record<string, string> = {}
  const denetim: { alan: string; eski: string | null; yeni: string }[] = []
  for (const s of secimler) {
    if (!AKTARILAN_ALANLAR.includes(s.alan)) continue
    let yeni = s.yeni?.trim()
    if (!yeni) continue
    const eski = ((kisi as Record<string, unknown>)[s.alan] as string | null)?.trim() || null

    if (s.alan === 'profil_baglantisi') {
      const n = linkedinNormalize(yeni)
      if (!n?.tamam) continue
      const sahip = linkedinSahipleri.get(n.kimlik)
      if (sahip && sahip !== kisiId) {
        sonuc.uyarilar.push(`${kisi.ad}: bu LinkedIn adresi başka bir kişide kayıtlı, yazılmadı.`)
        sonuc.atlananAlan++
        continue
      }
      linkedinSahipleri.set(n.kimlik, kisiId)
      yeni = n.adres
    }

    if (eski && anahtar(eski) === anahtar(yeni)) continue
    if (eski && !s.ez) {
      sonuc.atlananAlan++ // dolu alan, kullanıcı ezmeyi seçmedi
      continue
    }
    guncelleme[s.alan] = yeni
    denetim.push({ alan: s.alan, eski, yeni })
  }

  if (denetim.length === 0) return
  const { error: yazmaHatasi } = await db.from('kisiler').update(guncelleme).eq('id', kisiId)
  if (yazmaHatasi) {
    sonuc.uyarilar.push(beklenmeyenHata(`${kisi.ad}: yazılamadı`, yazmaHatasi))
    return
  }
  await db.from('degisiklik_gecmisi').insert([
    ...denetim.map((d) => ({
      tablo: 'kisiler',
      kayit_id: kisiId,
      alan: d.alan,
      eski_deger: d.eski,
      yeni_deger: d.yeni,
    })),
    {
      tablo: 'kisiler',
      kayit_id: kisiId,
      alan: 'kaynak',
      eski_deger: null,
      yeni_deger: `${kaynak}: ${denetim.map((d) => d.alan).join(', ')}`,
    },
  ])
  sonuc.yazilanAlan += denetim.length
}

/** Geçmiş kayıtlarını toplu yaz: kurumlar tek seferde, kayıtlar tek seferde. */
export async function gecmisleriYaz(
  db: SupabaseClient,
  secimler: GecmisSecimi[],
  kaynak: Kaynak,
  sonuc: YazimSonucu,
): Promise<void> {
  const gecerli = secimler.filter((g) => g.kurum?.trim() && kurumAnahtari(g.kurum))
  if (gecerli.length === 0) return

  // kurumlar: var olanları oku, eksikleri tek seferde ekle
  const anahtarlar = [...new Set(gecerli.map((g) => kurumAnahtari(g.kurum)))]
  const { data: varOlan, error } = await db.from('kurumlar').select('id, anahtar').in('anahtar', anahtarlar)
  if (error) {
    sonuc.uyarilar.push(beklenmeyenHata('Kurumlar okunamadı', error))
    return
  }
  const kurumId = new Map((varOlan ?? []).map((k) => [k.anahtar as string, k.id as string]))
  const eklenecekKurum = new Map<string, { ad: string; anahtar: string; tur: KurumTuru }>()
  for (const g of gecerli) {
    const a = kurumAnahtari(g.kurum)
    if (!kurumId.has(a) && !eklenecekKurum.has(a)) {
      eklenecekKurum.set(a, { ad: g.kurum.trim(), anahtar: a, tur: KURUM_TURLERI.includes(g.tur) ? g.tur : 'diger' })
    }
  }
  if (eklenecekKurum.size) {
    const { data: yeni, error: e } = await db.from('kurumlar').insert([...eklenecekKurum.values()]).select('id, anahtar')
    if (e) {
      sonuc.uyarilar.push(beklenmeyenHata('Kurumlar eklenemedi', e))
      return
    }
    for (const k of yeni ?? []) kurumId.set(k.anahtar as string, k.id as string)
  }

  // mükerrer geçmiş: aynı kişi + kurum + bölüm/unvan
  const kisiIdleri = [...new Set(gecerli.map((g) => g.kisiId))]
  const { data: mevcut } = await db
    .from('kisi_gecmisi')
    .select('kisi_id, kurum_id, alan')
    .in('kisi_id', kisiIdleri)
    .eq('arsiv', false)
  const imza = (k: string, u: string, a: string | null) => `${k}|${u}|${alanAnahtari(a)}`
  const goruldu = new Set((mevcut ?? []).map((m) => imza(m.kisi_id, m.kurum_id, m.alan)))

  const satirlar: {
    kisi_id: string
    kurum_id: string
    alan: string | null
    baslangic_yil: number | null
    bitis_yil: number | null
    guncel: boolean
    not: string
  }[] = []
  for (const g of gecerli) {
    const kid = kurumId.get(kurumAnahtari(g.kurum))!
    const i = imza(g.kisiId, kid, g.alan)
    if (goruldu.has(i)) {
      sonuc.atlananGecmis++
      continue
    }
    goruldu.add(i)
    const bas = yil(g.basYil)
    let bit = yil(g.bitYil)
    if (bas !== null && bit !== null && bit < bas) bit = null
    satirlar.push({
      kisi_id: g.kisiId,
      kurum_id: kid,
      alan: g.alan?.trim() || null,
      baslangic_yil: bas,
      bitis_yil: bit,
      guncel: Boolean(g.guncel),
      not: `kaynak: ${kaynak}`,
    })
  }
  if (satirlar.length === 0) return
  const { error: e2 } = await db.from('kisi_gecmisi').insert(satirlar)
  if (e2) {
    sonuc.uyarilar.push(beklenmeyenHata('Geçmiş yazılamadı', e2))
    return
  }
  await db.from('degisiklik_gecmisi').insert(
    kisiIdleri.map((id) => ({
      tablo: 'kisi_gecmisi',
      kayit_id: id,
      alan: 'kaynak',
      eski_deger: null,
      yeni_deger: `${kaynak}: ${satirlar.filter((s) => s.kisi_id === id).length} geçmiş kaydı eklendi`,
    })),
  )
  sonuc.eklenenGecmis += satirlar.length
}

/** Tüm kişilerin LinkedIn kimliği → kişi id. */
export async function linkedinSahipleriniOku(db: SupabaseClient): Promise<Map<string, string>> {
  const { data } = await db.from('kisiler').select('id, profil_baglantisi').not('profil_baglantisi', 'is', null)
  const harita = new Map<string, string>()
  for (const k of data ?? []) {
    const n = linkedinNormalize(k.profil_baglantisi as string)
    if (n?.tamam) harita.set(n.kimlik, k.id as string)
  }
  return harita
}
