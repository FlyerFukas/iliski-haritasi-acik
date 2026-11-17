/**
 * K-02: LinkedIn'den aktarım — saf ayrıştırıcılar (veritabanına dokunmaz).
 *
 * 1. Profil PDF'i: LinkedIn'de bir profil → "Diğer" → "PDF olarak kaydet".
 *    Düzen yazı boyutundan okunur (tüm LinkedIn PDF'lerinde sabit):
 *      ad 26 · bölüm başlığı 15.8 · şirket/okul 12 · unvan 11.5 · tarih/yer 10.5
 *    Sol sütun (x < 200): İletişim, yetenekler, diller.
 * 2. Connections.csv: Ayarlar → Verilerinin bir kopyası → Bağlantılar.
 */
import { linkedinNormalize } from './linkedin.ts'
import type { KurumTuru } from './ortak-nokta.ts'
import { anahtar } from './turkce.ts'

// ------------------------------------------------------------------ PDF

/** pdf.js metin parçası, sadeleştirilmiş. */
export interface PdfParca {
  sayfa: number
  x: number
  y: number
  boyut: number
  metin: string
}

export interface Deneyim {
  kurum: string
  unvan: string | null
  basYil: number | null
  bitYil: number | null
  devam: boolean
  yer: string | null
}

export interface Egitim {
  okul: string
  derece: string | null
  bolum: string | null
  basYil: number | null
  bitYil: number | null
}

export interface LinkedinProfil {
  ad: string | null
  baslik: string | null
  konum: string | null
  linkedin: string | null
  eposta: string | null
  deneyimler: Deneyim[]
  egitimler: Egitim[]
}

interface Satir {
  metin: string
  boyut: number
  sol: boolean
  sayfa: number
  y: number
}

const AYLAR =
  'january|february|march|april|may|june|july|august|september|october|november|december|' +
  'ocak|şubat|subat|mart|nisan|mayıs|mayis|haziran|temmuz|ağustos|agustos|eylül|eylul|ekim|kasım|kasim|aralık|aralik'
const SIMDI = 'present|halen|günümüz|gunumuz|şu anda|su anda|şimdi|simdi|hâlâ|hala|devam ediyor'
const TARIH_KALIBI = new RegExp(
  `^(?:(?:${AYLAR})\\s+)?(\\d{4})\\s*[-–]\\s*(?:(?:(?:${AYLAR})\\s+)?(\\d{4})|(${SIMDI}))`,
  'i',
)
const SURE_KALIBI = /^\(?\d+\s+(years?|months?|yıl|yil|ay)\b/i

const BOLUMLER: Record<string, 'ozet' | 'deneyim' | 'egitim' | 'diger'> = {
  summary: 'ozet', özet: 'ozet', ozet: 'ozet', hakkında: 'ozet', hakkinda: 'ozet',
  experience: 'deneyim', deneyim: 'deneyim',
  education: 'egitim', eğitim: 'egitim', egitim: 'egitim',
}

const yakin = (a: number, b: number) => Math.abs(a - b) < 0.3

/** Parçaları sütun + satır olarak birleştir, sayfa altlıklarını at. */
function satirlaraCevir(parcalar: PdfParca[]): Satir[] {
  const temiz = parcalar.filter((p) => p.metin.trim() && p.boyut > 9.5)
  temiz.sort((a, b) => a.sayfa - b.sayfa || (a.x < 200 ? 0 : 1) - (b.x < 200 ? 0 : 1) || b.y - a.y || a.x - b.x)
  const satirlar: Satir[] = []
  for (const p of temiz) {
    const sol = p.x < 200
    const son = satirlar[satirlar.length - 1]
    if (son && son.sayfa === p.sayfa && son.sol === sol && Math.abs(son.y - p.y) < 2) {
      son.metin += ' ' + p.metin.trim()
    } else {
      satirlar.push({ metin: p.metin.trim(), boyut: p.boyut, sol, sayfa: p.sayfa, y: p.y })
    }
  }
  // Sol sütun satırları önce gelsin ki ana sütunun akışı sayfa geçişlerinde bölünmesin
  return [...satirlar.filter((s) => s.sol), ...satirlar.filter((s) => !s.sol)]
}

function yillar(metin: string): { bas: number | null; bit: number | null; devam: boolean } | null {
  const e = metin.match(TARIH_KALIBI)
  if (!e) return null
  return { bas: Number(e[1]), bit: e[2] ? Number(e[2]) : null, devam: Boolean(e[3]) }
}

export function profilAyristir(parcalar: PdfParca[]): LinkedinProfil {
  const satirlar = satirlaraCevir(parcalar)
  const profil: LinkedinProfil = {
    ad: null, baslik: null, konum: null, linkedin: null, eposta: null, deneyimler: [], egitimler: [],
  }

  // --- sol sütun: iletişim
  const solMetin = satirlar.filter((s) => s.sol).map((s) => s.metin).join(' ')
  const li = solMetin.replace(/\s+/g, ' ').match(/(?:www\.)?linkedin\.com\/in\/\s?([^\s(]+)/i)
  if (li) {
    const n = linkedinNormalize(`linkedin.com/in/${li[1]}`)
    if (n?.tamam) profil.linkedin = n.adres
  }
  profil.eposta = solMetin.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)?.[0] ?? null

  // --- ana sütun
  const ana = satirlar.filter((s) => !s.sol)
  let i = 0
  const adSatiri = ana.findIndex((s) => s.boyut >= 20)
  if (adSatiri >= 0) {
    profil.ad = ana[adSatiri].metin
    i = adSatiri + 1
    const ust: string[] = []
    while (i < ana.length && yakin(ana[i].boyut, 12)) ust.push(ana[i++].metin)
    if (ust.length >= 2) {
      profil.konum = ust.pop()!
      profil.baslik = ust.join(' ')
    } else if (ust.length === 1) {
      profil.baslik = ust[0]
    }
  }

  let bolum: 'ozet' | 'deneyim' | 'egitim' | 'diger' = 'diger'
  let kurum: string | null = null
  let rol: Deneyim | null = null
  let okul: Egitim | null = null
  let okulMetni: string[] = []
  let oncekiTur: 'kurum' | 'unvan' | 'tarih' | 'diger' = 'diger'

  const okuluBitir = () => {
    if (!okul) return
    const metin = okulMetni.join(' ').replace(/\s+/g, ' ').trim()
    const [sol, sag] = metin.split('·').map((p) => p?.trim() ?? '')
    if (sol) {
      const virgul = sol.lastIndexOf(',')
      okul.derece = virgul >= 0 ? sol.slice(0, virgul).trim() : null
      okul.bolum = (virgul >= 0 ? sol.slice(virgul + 1) : sol).trim() || null
    }
    const y = (sag || metin).match(/\d{4}/g)
    if (y) {
      okul.basYil = Number(y[0])
      okul.bitYil = y[1] ? Number(y[1]) : null
    }
    profil.egitimler.push(okul)
    okul = null
    okulMetni = []
  }

  for (; i < ana.length; i++) {
    const s = ana[i]
    if (s.boyut > 14.5) {
      okuluBitir()
      bolum = BOLUMLER[anahtar(s.metin)] ?? BOLUMLER[s.metin.toLowerCase()] ?? 'diger'
      kurum = null
      rol = null
      oncekiTur = 'diger'
      continue
    }

    if (bolum === 'deneyim') {
      if (yakin(s.boyut, 12)) {
        kurum = oncekiTur === 'kurum' && kurum ? `${kurum} ${s.metin}` : s.metin
        oncekiTur = 'kurum'
      } else if (yakin(s.boyut, 11.5) && kurum) {
        if (oncekiTur === 'unvan' && rol) {
          rol.unvan = `${rol.unvan} ${s.metin}` // iki satıra taşan unvan
        } else {
          rol = { kurum, unvan: s.metin, basYil: null, bitYil: null, devam: false, yer: null }
          profil.deneyimler.push(rol)
        }
        oncekiTur = 'unvan'
      } else if (oncekiTur === 'kurum' && SURE_KALIBI.test(s.metin)) {
        // çok pozisyonlu şirketin toplam süresi ("8 years 8 months"): atla
      } else if (oncekiTur === 'unvan' && rol) {
        const y = yillar(s.metin)
        if (y) {
          rol.basYil = y.bas
          rol.bitYil = y.bit
          rol.devam = y.devam
          oncekiTur = 'tarih'
        } else {
          oncekiTur = 'diger'
        }
      } else if (oncekiTur === 'tarih' && rol) {
        // Yer, tarihin hemen altındadır (~15 birim); açıklama daha aşağıdan (~21) başlar
        const onceki = ana[i - 1]
        const bitisik = onceki.sayfa === s.sayfa && onceki.y - s.y < 17.5
        if (bitisik && s.metin.length < 70 && !/^[●•\-–]/.test(s.metin)) rol.yer = s.metin
        oncekiTur = 'diger'
      } else {
        oncekiTur = 'diger'
      }
    } else if (bolum === 'egitim') {
      if (yakin(s.boyut, 12)) {
        okuluBitir()
        okul = { okul: s.metin, derece: null, bolum: null, basYil: null, bitYil: null }
      } else if (okul) {
        okulMetni.push(s.metin)
      }
    }
  }
  okuluBitir()
  return profil
}

/** Kurum adından tür tahmini — kullanıcı önizlemede değiştirebilir. */
export function kurumTuruTahmin(ad: string, egitim = false): KurumTuru {
  const k = anahtar(ad)
  if (/\b(lisesi|lise|high school|koleji|kolej|anadolu)\b/.test(k)) return 'okul'
  if (/universite|university|universitat|universitaet|college|institute of technology|enstitusu|school of/.test(k)) return 'universite'
  if (/\b(vakfi|vakif|foundation|fondation|stiftung)\b/.test(k)) return 'vakif'
  if (/\b(dernegi|dernek|association|society|federasyonu)\b/.test(k)) return 'dernek'
  if (/\b(kulubu|kulup|club|toplulugu|topluluk|community)\b/.test(k)) return 'topluluk'
  if (/\b(bakanligi|belediyesi|valiligi|ministry|municipality|kamu)\b/.test(k)) return 'kamu'
  return egitim ? 'universite' : 'sirket'
}

// ------------------------------------------------------------------ CSV

export interface Baglanti {
  ad: string
  linkedin: string | null
  eposta: string | null
  sirket: string | null
  pozisyon: string | null
  baglantiTarihi: string | null
}

/** Tırnaklı alanları destekleyen küçük CSV ayrıştırıcı. */
function csvSatirlari(metin: string): string[][] {
  const satirlar: string[][] = []
  let alan = ''
  let satir: string[] = []
  let tirnak = false
  for (let i = 0; i < metin.length; i++) {
    const c = metin[i]
    if (tirnak) {
      if (c === '"' && metin[i + 1] === '"') {
        alan += '"'
        i++
      } else if (c === '"') tirnak = false
      else alan += c
    } else if (c === '"') tirnak = true
    else if (c === ',') {
      satir.push(alan)
      alan = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && metin[i + 1] === '\n') i++
      satir.push(alan)
      satirlar.push(satir)
      satir = []
      alan = ''
    } else alan += c
  }
  if (alan || satir.length) {
    satir.push(alan)
    satirlar.push(satir)
  }
  return satirlar
}

/**
 * LinkedIn `Connections.csv`. Dosyanın başında "Notes:" açıklaması olur;
 * başlık satırı "First Name" ile başlayan satırdır.
 */
export function baglantilariAyristir(metin: string): Baglanti[] {
  const satirlar = csvSatirlari(metin.replace(/^﻿/, ''))
  const b = satirlar.findIndex((s) => /^(first name|ad[ıi])$/i.test((s[0] ?? '').trim()))
  if (b < 0) throw new Error('Bu bir LinkedIn Connections.csv dosyası değil: "First Name" başlığı bulunamadı.')
  const baslik = satirlar[b].map((h) => h.trim().toLowerCase())
  const sutun = (...adlar: string[]) => baslik.findIndex((h) => adlar.includes(h))
  const s = {
    ad: sutun('first name', 'adı', 'adi'),
    soyad: sutun('last name', 'soyadı', 'soyadi'),
    url: sutun('url'),
    eposta: sutun('email address', 'e-posta adresi'),
    sirket: sutun('company', 'şirket', 'sirket'),
    pozisyon: sutun('position', 'pozisyon'),
    tarih: sutun('connected on', 'bağlantı tarihi'),
  }
  const al = (r: string[], i: number) => (i >= 0 ? (r[i] ?? '').trim() || null : null)

  return satirlar
    .slice(b + 1)
    .map((r) => {
      const ad = [al(r, s.ad), al(r, s.soyad)].filter(Boolean).join(' ').trim()
      const li = linkedinNormalize(al(r, s.url))
      return {
        ad,
        linkedin: li?.tamam ? li.adres : null,
        eposta: al(r, s.eposta),
        sirket: al(r, s.sirket),
        pozisyon: al(r, s.pozisyon),
        baglantiTarihi: al(r, s.tarih),
      }
    })
    .filter((x) => x.ad)
}

// ------------------------------------------------------------------ öneri

/** LinkedIn'den doldurulabilen kişi alanları. */
export const AKTARILAN_ALANLAR = ['profil_baglantisi', 'eposta', 'sirket', 'rol', 'sehir'] as const
export type AktarilanAlan = (typeof AKTARILAN_ALANLAR)[number]

export interface AlanOnerisi {
  alan: AktarilanAlan
  mevcut: string | null
  yeni: string
  /** Mevcut değer dolu ve farklı: varsayılan olarak UYGULANMAZ, kullanıcı seçerse ezilir. */
  cakisma: boolean
}

export interface GecmisOnerisi {
  kurum: string
  tur: KurumTuru
  alan: string | null
  basYil: number | null
  bitYil: number | null
  guncel: boolean
  /** Kişide aynı kurum + aynı bölüm/unvan zaten var: atlanır. */
  zatenVar: boolean
}

export interface Oneri {
  alanlar: AlanOnerisi[]
  gecmis: GecmisOnerisi[]
}

/** Kişinin mevcut alanları ve geçmiş izleri (kurum + alan anahtarı). */
export interface MevcutKisi {
  alanlar: Partial<Record<AktarilanAlan, string | null>>
  izler: { kurumAnahtari: string; alanAnahtari: string }[]
}

const SEHIR_DUZELT: Record<string, string> = { istanbul: 'İstanbul', izmir: 'İzmir' }

function sehirCikar(konum: string | null): string | null {
  const ilk = konum?.split(',')[0]?.trim()
  if (!ilk) return null
  return SEHIR_DUZELT[anahtar(ilk)] ?? ilk
}

function linkedinKimlik(adres: string | null): string | null {
  const n = linkedinNormalize(adres)
  return n?.tamam ? n.kimlik : null
}

function alanOner(m: MevcutKisi, alan: AktarilanAlan, yeni: string | null | undefined): AlanOnerisi | null {
  const deger = yeni?.trim()
  if (!deger) return null
  const mevcut = m.alanlar[alan]?.trim() || null
  const ayni =
    alan === 'profil_baglantisi'
      ? linkedinKimlik(mevcut) !== null && linkedinKimlik(mevcut) === linkedinKimlik(deger)
      : anahtar(mevcut) === anahtar(deger)
  if (ayni) return null
  return { alan, mevcut, yeni: deger, cakisma: mevcut !== null }
}

function gecmisOner(
  m: MevcutKisi,
  kurumAnahtariBul: (ad: string) => string,
  alanAnahtariBul: (alan: string | null) => string,
  g: Omit<GecmisOnerisi, 'zatenVar'>,
): GecmisOnerisi {
  const ka = kurumAnahtariBul(g.kurum)
  const aa = alanAnahtariBul(g.alan)
  return { ...g, zatenVar: m.izler.some((i) => i.kurumAnahtari === ka && i.alanAnahtari === aa) }
}

/** PDF profilinden öneri. Anahtar fonksiyonları ortak-nokta.ts'ten verilir (tek kaynak). */
export function profilOnerisi(
  m: MevcutKisi,
  p: LinkedinProfil,
  kurumAnahtariBul: (ad: string) => string,
  alanAnahtariBul: (alan: string | null) => string,
): Oneri {
  const simdiki = p.deneyimler.find((d) => d.devam) ?? null
  const alanlar = [
    alanOner(m, 'profil_baglantisi', p.linkedin),
    alanOner(m, 'eposta', p.eposta),
    alanOner(m, 'sirket', simdiki?.kurum),
    alanOner(m, 'rol', p.baslik),
    alanOner(m, 'sehir', sehirCikar(p.konum)),
  ].filter((x): x is AlanOnerisi => x !== null)

  const gecmis = [
    ...p.deneyimler.map((d) => ({
      kurum: d.kurum,
      tur: kurumTuruTahmin(d.kurum),
      alan: d.unvan,
      basYil: d.basYil,
      bitYil: d.devam ? null : d.bitYil,
      guncel: d.devam,
    })),
    ...p.egitimler.map((e) => ({
      kurum: e.okul,
      tur: kurumTuruTahmin(e.okul, true),
      alan: e.bolum,
      basYil: e.basYil,
      bitYil: e.bitYil,
      guncel: false,
    })),
  ].map((g) => gecmisOner(m, kurumAnahtariBul, alanAnahtariBul, g))

  return { alanlar, gecmis }
}

/** CSV bağlantısından öneri: LinkedIn adresi, e-posta, şirket, pozisyon. */
export function baglantiOnerisi(
  m: MevcutKisi,
  b: Baglanti,
  kurumAnahtariBul: (ad: string) => string,
  alanAnahtariBul: (alan: string | null) => string,
): Oneri {
  const alanlar = [
    alanOner(m, 'profil_baglantisi', b.linkedin),
    alanOner(m, 'eposta', b.eposta),
    alanOner(m, 'sirket', b.sirket),
    alanOner(m, 'rol', b.pozisyon),
  ].filter((x): x is AlanOnerisi => x !== null)
  const gecmis = b.sirket
    ? [
        gecmisOner(m, kurumAnahtariBul, alanAnahtariBul, {
          kurum: b.sirket,
          tur: kurumTuruTahmin(b.sirket),
          alan: b.pozisyon,
          basYil: null,
          bitYil: null,
          guncel: true,
        }),
      ]
    : []
  return { alanlar, gecmis }
}
