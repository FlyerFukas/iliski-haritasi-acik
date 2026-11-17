import { aciliyetSirasi, type Durum, type KisiOzet } from './hesaplama'
import { anahtar, sirala } from './turkce'
import { linkedinMi } from './linkedin'

/**
 * Kişi listesi süzme ve sıralama — URL'den okunur, sunucuda uygulanır.
 *
 * Filtreler adres çubuğunda yaşadığı için panel sayaçlarından gelen
 * "?durum=GECIKTI" bağlantısı, tarayıcı geri tuşu ve yer imi kendiliğinden
 * çalışır.
 */

export type Siralama = 'sonraki' | 'ad' | 'son-temas'

export interface Suzgec {
  durum: string[]
  halka: string[]
  kategori: string[]
  frekans: string[]
  sektor: string[]
  sehir: string[]
  q: string
  sirala: Siralama
  arsiv: boolean
  /** K-01: '' hepsi, 'yok' LinkedIn'i olmayanlar, 'var' olanlar */
  linkedin: '' | 'yok' | 'var'
}

const SIRALAMALAR: Siralama[] = ['sonraki', 'ad', 'son-temas']

function liste(deger: string | string[] | undefined): string[] {
  if (!deger) return []
  const ham = Array.isArray(deger) ? deger : [deger]
  return ham.flatMap((d) => d.split(',')).map((d) => d.trim()).filter(Boolean)
}

export function suzgecOku(
  searchParams: Record<string, string | string[] | undefined>,
): Suzgec {
  const siralaHam = String(searchParams.sirala ?? '')
  return {
    durum: liste(searchParams.durum),
    halka: liste(searchParams.halka),
    kategori: liste(searchParams.kategori),
    frekans: liste(searchParams.frekans),
    sektor: liste(searchParams.sektor),
    sehir: liste(searchParams.sehir),
    q: String(searchParams.q ?? '').trim(),
    sirala: SIRALAMALAR.includes(siralaHam as Siralama)
      ? (siralaHam as Siralama)
      : 'sonraki',
    arsiv: searchParams.arsiv === '1',
    linkedin: searchParams.linkedin === 'yok' || searchParams.linkedin === 'var' ? searchParams.linkedin : '',
  }
}

/** Kaç filtre etkin — "Filtreleri temizle" düğmesini göstermek için. */
export function etkinSuzgecSayisi(s: Suzgec): number {
  return (
    s.durum.length +
    s.halka.length +
    s.kategori.length +
    s.frekans.length +
    s.sektor.length +
    s.sehir.length +
    (s.q ? 1 : 0) +
    (s.linkedin ? 1 : 0)
  )
}

export function suz(ozetler: KisiOzet[], s: Suzgec): KisiOzet[] {
  const aramaAnahtari = anahtar(s.q)

  const suzulmus = ozetler.filter((o) => {
    const k = o.kisi

    if (s.durum.length && !s.durum.includes(o.durum)) return false
    if (s.halka.length && !(k.halka && s.halka.includes(k.halka))) return false
    if (s.kategori.length && !(k.kategori && s.kategori.includes(k.kategori))) return false
    if (s.frekans.length && !s.frekans.includes(String(k.frekans))) return false
    if (s.sektor.length && !(k.sektor && s.sektor.includes(k.sektor))) return false
    if (s.sehir.length && !(k.sehir && s.sehir.includes(k.sehir))) return false
    if (s.linkedin && linkedinMi(k.profil_baglantisi) !== (s.linkedin === 'var')) return false

    if (aramaAnahtari) {
      // Ad, şirket ve kişisel detay içinde ara (SPEC §5.2)
      const havuz = [k.ad, k.sirket, k.kisisel_detay, k.rol, k.yapilacak_hamle]
        .map(anahtar)
        .join(' ')
      if (!havuz.includes(aramaAnahtari)) return false
    }

    return true
  })

  return suzulmus.sort((a, b) => {
    switch (s.sirala) {
      case 'ad':
        return sirala(a.kisi.ad, b.kisi.ad)
      case 'son-temas': {
        // en yeni temas üstte; hiç teması olmayan en sonda
        if (!a.sonTemasTarihi && !b.sonTemasTarihi) return sirala(a.kisi.ad, b.kisi.ad)
        if (!a.sonTemasTarihi) return 1
        if (!b.sonTemasTarihi) return -1
        return b.sonTemasTarihi.localeCompare(a.sonTemasTarihi)
      }
      default:
        return aciliyetSirasi(a, b)
    }
  })
}

export const DURUM_SECENEKLERI: Durum[] = ['GECIKTI', 'YAKLASIYOR', 'GUNCEL', 'KAYIT_YOK']
