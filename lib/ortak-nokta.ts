/**
 * K-04: Kişiler arası ortak noktalar — TEK KAYNAK.
 *
 * Kişi detayı, ağ haritası ve tanıştırma fırsatları hep buradaki
 * `baglariHesapla` sonucunu kullanır; ortak nokta mantığı başka yerde yazılmaz.
 *
 * İki kaynak var:
 *  - `kisi_gecmisi` kayıtları (kesin): kurum + bölüm/unvan + yıllar
 *  - kişinin serbest metin `sirket` alanı (olası): normalize edilip kuruma
 *    eşlenir. Eski veri olduğu gibi kalır, yalnızca okunur.
 */
import type { Kisi } from './hesaplama.ts'
import { anahtar } from './turkce.ts'

// ------------------------------------------------------------------ türler

export const KURUM_TURLERI = [
  'sirket',
  'universite',
  'okul',
  'vakif',
  'dernek',
  'topluluk',
  'kamu',
  'diger',
] as const
export type KurumTuru = (typeof KURUM_TURLERI)[number]

export const KURUM_TURU_ETIKET: Record<KurumTuru, string> = {
  sirket: 'Şirket',
  universite: 'Üniversite',
  okul: 'Lise / okul',
  vakif: 'Vakıf',
  dernek: 'Dernek',
  topluluk: 'Kulüp / topluluk',
  kamu: 'Kamu kurumu',
  diger: 'Diğer',
}

/** Bu türlerde `alan` alanı "bölüm" demek; diğerlerinde "unvan / görev". */
export const EGITIM_TURLERI: KurumTuru[] = ['universite', 'okul']

export interface Kurum {
  id: string
  ad: string
  anahtar: string
  tur: KurumTuru
  sektor: string | null
  sehir: string | null
}

export interface GecmisKaydi {
  id: string
  kisi_id: string
  kurum_id: string
  alan: string | null
  baslangic_yil: number | null
  bitis_yil: number | null
  guncel: boolean
  not: string | null
  arsiv: boolean
  created_at?: string
}

export type NoktaTuru =
  | 'kurum' // aynı kurum
  | 'alan' // farklı kurumda aynı bölüm / unvan
  | 'sektor'
  | 'sehir'

export interface OrtakNokta {
  tur: NoktaTuru
  /** Ekranda gösterilen cümle: "TEV · aynı dönemde" */
  aciklama: string
  agirlik: number
  /** Serbest metinden çıkarıldıysa false: "olası" diye gösterilir. */
  kesin: boolean
  kurumTuru?: KurumTuru
  /** Aynı kurumda aynı dönem ya da aynı bölüm/görev: kurumdan daha yakın bir bağ. */
  yakin?: boolean
}

export interface Bag {
  a: string
  b: string
  noktalar: OrtakNokta[]
  /** Noktaların ağırlık toplamı — çizgi kalınlığı ve sıralama için. */
  guc: number
}

/** Bir kişinin bir kuruma ya da alana dair izi (geçmişten ya da metinden). */
export interface Iz {
  kurumAnahtari: string
  kurumAdi: string
  kurumTuru: KurumTuru
  alanAnahtari: string
  alanAdi: string | null
  bas: number | null
  bit: number | null
  guncel: boolean
  kesin: boolean
}

// ------------------------------------------------------------------ normalleştirme

/** Kurum adı sonundaki hukuki ekler ve önündeki "ex-" eşleşmeyi bozmasın. */
const KURUM_EKLERI =
  /\b(a\.?\s?s\.?|ltd\.?|sti\.?|sirketi|inc\.?|llc|gmbh|plc|corp\.?|co\.?|limited)\b/g

/**
 * Kurum eşleştirme anahtarı. "TEV", "Tev", "Tev den", "ex-Citi" ve
 * "Citi A.Ş." gibi yazımlar aynı anahtara düşer.
 */
export function kurumAnahtari(ad: string | null | undefined): string {
  let k = anahtar(ad)
  if (!k) return ''
  k = k
    .replace(/^(ex|eski)[\s-]+/, '')
    .replace(/['’]?\s?(den|dan|ten|tan)$/, '') // "Tev'den", "Tev den"
    .replace(KURUM_EKLERI, ' ')
    .replace(/[.,;:()"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return KURUM_ESANLAMLI[k] ?? k
}

/** Bilinen kısaltmalar / yazım farkları → tek anahtar. Genişletilebilir. */
const KURUM_ESANLAMLI: Record<string, string> = {
  'turk egitim vakfi': 'tev',
  'kuveyt turk': 'kuveyturk',
  'kuveyt turk katilim bankasi': 'kuveyturk',
  'ing': 'ing bank',
  'ing turkiye': 'ing bank',
  'yildiz teknik universitesi': 'ytu',
  'yildiz teknik': 'ytu',
  'mimar sinan guzel sanatlar universitesi': 'msgsu',
  'galatasaray uni': 'galatasaray universitesi',
}

/**
 * Şirket alanına yazılmış ama kurum olmayan değerler (meslek, durum,
 * belirsiz). Bunlar ortak nokta üretmez; aksi halde "öğrenci" yazan herkes
 * birbirine bağlanırdı.
 */
const KURUM_DEGIL = new Set([
  'avukat',
  'ogrenci',
  'serbest',
  'unknown',
  'bilinmiyor',
  'belediye',
  'finansal danisman',
  'aile sirketi',
  'aile',
  'serbest meslek',
  'emekli',
  'issiz',
])

/** Meslek / durum sözcüğüyle başlayan değerler de kurum sayılmaz ("avukat/öğrenci"). */
const KURUM_DEGIL_ONEK = /^(avukat|ogrenci|serbest|b\w?gimsiz|hastane|hastahane|doktor|freelance)\b/

/** Serbest metin şirket alanından anlamlı bir kurum anahtarı çıkar. */
export function metindenKurum(sirket: string | null): { anahtar: string; ad: string } | null {
  if (!sirket) return null
  // "X / Y  7 yıl 3 ay  Data Scientist" gibi uzun metinlerde ilk parça kurumdur
  const ilk = sirket.split(/\s{2,}|\s\/\s|,/)[0]?.trim() ?? ''
  const k = kurumAnahtari(ilk)
  if (k.length < 2 || KURUM_DEGIL.has(k) || KURUM_DEGIL_ONEK.test(k)) return null
  return { anahtar: k, ad: gorunenAd(ilk) }
}

/** "Tev den" → "Tev", "ex-Citi" → "Citi", "BOEING" → "Boeing" (kısaltmalar kalır). */
function gorunenAd(ham: string): string {
  const sade = ham
    .replace(/^(ex|eski)[\s-]+/i, '')
    .replace(/['’]?\s?(den|dan|ten|tan|DEN|DAN)$/, '')
    .trim()
  if (sade.length <= 4 || sade !== sade.toLocaleUpperCase('tr')) return sade
  // "BOEING" Türkçe kuralla "Boeıng" olurdu; Türkçe harf yoksa İngilizce küçült
  const dil = /[ÇĞİÖŞÜ]/.test(sade) ? 'tr' : 'en'
  return sade
    .toLocaleLowerCase(dil)
    .replace(/(^|\s)(\S)/g, (_, b: string, h: string) => b + h.toLocaleUpperCase(dil))
}

/** Bölüm / unvan eşdeğerleri (Türkçe ↔ İngilizce). Genişletilebilir. */
const ALAN_ESANLAMLI: Record<string, string> = {
  'industrial engineering': 'endustri muhendisligi',
  'endustri': 'endustri muhendisligi',
  'computer engineering': 'bilgisayar muhendisligi',
  'economics': 'iktisat',
  'ekonomi': 'iktisat',
  'business administration': 'isletme',
  'law': 'hukuk',
  'statistics': 'istatistik',
  'sales manager': 'satis muduru',
  'data scientist': 'veri bilimci',
  'project lead': 'proje lideri',
  'mentor': 'mentor',
  'mentoru': 'mentor',
}

export function alanAnahtari(alan: string | null | undefined): string {
  const k = anahtar(alan).replace(/[.,;:()"]/g, ' ').replace(/\s+/g, ' ').trim()
  return ALAN_ESANLAMLI[k] ?? k
}

const SEKTOR_ESANLAMLI: Record<string, string> = {
  consulting: 'danismanlik',
  telekominakasyon: 'telekom',
  telekomunikasyon: 'telekom',
  'ulasim/tasimacilik': 'ulasim',
}

function sektorAnahtari(s: string | null): string {
  const k = anahtar(s)
  return SEKTOR_ESANLAMLI[k] ?? k
}

const SEHIR_ESANLAMLI: Record<string, string> = { istnabul: 'istanbul' }

function sehirAnahtari(s: string | null): string {
  const k = anahtar(s)
  return SEHIR_ESANLAMLI[k] ?? k
}

// ------------------------------------------------------------------ izler

/**
 * Bir kişinin tüm izleri: geçmiş kayıtları + (geçmişte zaten yoksa)
 * şirket alanından çıkarılan olası iz.
 */
export function kisiIzleri(
  kisi: Kisi,
  gecmis: GecmisKaydi[],
  kurumlar: Map<string, Kurum>,
): Iz[] {
  const izler: Iz[] = []
  for (const g of gecmis) {
    if (g.arsiv || g.kisi_id !== kisi.id) continue
    const kurum = kurumlar.get(g.kurum_id)
    if (!kurum) continue
    izler.push({
      kurumAnahtari: kurum.anahtar,
      kurumAdi: kurum.ad,
      kurumTuru: kurum.tur,
      alanAnahtari: alanAnahtari(g.alan),
      alanAdi: g.alan,
      bas: g.baslangic_yil,
      bit: g.bitis_yil,
      guncel: g.guncel,
      kesin: true,
    })
  }

  const metin = metindenKurum(kisi.sirket)
  if (metin && !izler.some((i) => i.kurumAnahtari === metin.anahtar)) {
    // Bilinen bir kurumla eşleşiyorsa onun adını ve türünü kullan
    const bilinen = [...kurumlar.values()].find((k) => k.anahtar === metin.anahtar)
    izler.push({
      kurumAnahtari: metin.anahtar,
      kurumAdi: bilinen?.ad ?? metin.ad,
      kurumTuru: bilinen?.tur ?? 'sirket',
      alanAnahtari: '',
      alanAdi: null,
      bas: null,
      bit: null,
      guncel: true,
      kesin: false,
    })
  }
  return izler
}

// ------------------------------------------------------------------ hesap

const KURUM_AGIRLIK: Record<KurumTuru, number> = {
  sirket: 3,
  universite: 3,
  okul: 3,
  vakif: 3,
  dernek: 2.5,
  topluluk: 2,
  kamu: 2,
  diger: 2,
}
const DONEM_EK = 2
const BOLUM_EK = 1.5
const OLASI_CARPAN = 0.6
const ALAN_AGIRLIK = 1
const SEKTOR_AGIRLIK = 0.7
const SEHIR_AGIRLIK = 0.3

/** İki izin yılları çakışıyor mu? Yıl bilgisi yoksa bilinmiyor → null. */
function donemCakisir(x: Iz, y: Iz, buYil: number): boolean | null {
  const aralik = (i: Iz): [number, number] | null => {
    if (i.bas === null && !i.guncel) return null
    const bas = i.bas ?? (i.guncel ? buYil : (i.bit as number))
    const bit = i.guncel ? buYil : (i.bit ?? bas)
    return [bas, bit]
  }
  const a = aralik(x)
  const b = aralik(y)
  if (!a || !b) return null
  return a[0] <= b[1] && b[0] <= a[1]
}

export interface HesapSecenekleri {
  sektor?: boolean
  sehir?: boolean
  buYil?: number
}

/** İki kişi arasındaki ortak noktalar. */
export function ikiKisiOrtak(
  k1: Kisi,
  izler1: Iz[],
  k2: Kisi,
  izler2: Iz[],
  secenek: HesapSecenekleri = {},
): OrtakNokta[] {
  const buYil = secenek.buYil ?? new Date().getFullYear()
  const noktalar: OrtakNokta[] = []
  const gorulenKurum = new Set<string>()

  // aynı kurum
  for (const x of izler1) {
    for (const y of izler2) {
      if (x.kurumAnahtari !== y.kurumAnahtari || gorulenKurum.has(x.kurumAnahtari)) continue
      gorulenKurum.add(x.kurumAnahtari)
      const kesin = x.kesin && y.kesin
      let agirlik = KURUM_AGIRLIK[x.kurumTuru]
      const ekler: string[] = []
      const bolum = x.alanAnahtari && x.alanAnahtari === y.alanAnahtari
      if (bolum) {
        agirlik += BOLUM_EK
        ekler.push(EGITIM_TURLERI.includes(x.kurumTuru) ? `aynı bölüm (${x.alanAdi})` : `aynı görev (${x.alanAdi})`)
      }
      // Dönem yalnızca iki tarafın da geçmiş kaydı varsa söylenir; şirket
      // alanı "şu an orada" demek zorunda değil.
      if (kesin && donemCakisir(x, y, buYil)) {
        agirlik += DONEM_EK
        ekler.push(x.guncel && y.guncel ? 'ikisi de hâlâ orada' : 'aynı dönemde')
      }
      if (!kesin) agirlik *= OLASI_CARPAN
      noktalar.push({
        tur: 'kurum',
        aciklama: [x.kurumAdi, ...ekler].join(' · '),
        agirlik,
        kesin,
        kurumTuru: x.kurumTuru,
        yakin: ekler.length > 0,
      })
    }
  }

  // farklı kurumda aynı bölüm / unvan
  const gorulenAlan = new Set<string>()
  for (const x of izler1) {
    if (!x.alanAnahtari) continue
    for (const y of izler2) {
      if (y.alanAnahtari !== x.alanAnahtari || x.kurumAnahtari === y.kurumAnahtari) continue
      if (gorulenAlan.has(x.alanAnahtari)) continue
      gorulenAlan.add(x.alanAnahtari)
      const egitim = EGITIM_TURLERI.includes(x.kurumTuru) && EGITIM_TURLERI.includes(y.kurumTuru)
      noktalar.push({
        tur: 'alan',
        aciklama: egitim
          ? `ikisi de ${x.alanAdi} okumuş (${x.kurumAdi} / ${y.kurumAdi})`
          : `benzer görev: ${x.alanAdi}`,
        agirlik: ALAN_AGIRLIK,
        kesin: true,
        kurumTuru: egitim ? x.kurumTuru : undefined,
      })
    }
  }

  if (secenek.sektor !== false) {
    const s1 = sektorAnahtari(k1.sektor)
    if (s1 && s1 === sektorAnahtari(k2.sektor)) {
      noktalar.push({ tur: 'sektor', aciklama: `aynı sektör: ${k1.sektor}`, agirlik: SEKTOR_AGIRLIK, kesin: true })
    }
  }
  if (secenek.sehir) {
    const s1 = sehirAnahtari(k1.sehir)
    if (s1 && s1 === sehirAnahtari(k2.sehir)) {
      noktalar.push({ tur: 'sehir', aciklama: `aynı şehir: ${k1.sehir}`, agirlik: SEHIR_AGIRLIK, kesin: true })
    }
  }

  return noktalar.sort((a, b) => b.agirlik - a.agirlik)
}

/** Tüm kişi çiftleri arasındaki bağlar, güçlüden zayıfa. */
export function baglariHesapla(
  kisiler: Kisi[],
  gecmis: GecmisKaydi[],
  kurumlar: Kurum[],
  secenek: HesapSecenekleri = {},
): Bag[] {
  const kurumHaritasi = new Map(kurumlar.map((k) => [k.id, k]))
  const izler = new Map(kisiler.map((k) => [k.id, kisiIzleri(k, gecmis, kurumHaritasi)]))
  const baglar: Bag[] = []

  for (let i = 0; i < kisiler.length; i++) {
    for (let j = i + 1; j < kisiler.length; j++) {
      const a = kisiler[i]
      const b = kisiler[j]
      const noktalar = ikiKisiOrtak(a, izler.get(a.id)!, b, izler.get(b.id)!, secenek)
      if (noktalar.length === 0) continue
      const guc = noktalar.reduce((t, n) => t + n.agirlik, 0)
      baglar.push({ a: a.id, b: b.id, noktalar, guc: Math.round(guc * 10) / 10 })
    }
  }
  return baglar.sort((x, y) => y.guc - x.guc)
}

/** Bir kişinin bağları, karşı tarafın id'si ile. */
export function kisininBaglari(kisiId: string, baglar: Bag[]): { digerId: string; bag: Bag }[] {
  return baglar
    .filter((b) => b.a === kisiId || b.b === kisiId)
    .map((bag) => ({ digerId: bag.a === kisiId ? bag.b : bag.a, bag }))
}
