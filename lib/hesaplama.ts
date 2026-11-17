/**
 * İŞ MANTIĞI — TEK KAYNAK (CLAUDE.md).
 *
 * Excel v7'deki formüllerin karşılığı. Bu dosyadaki mantık başka hiçbir yerde
 * tekrarlanmaz; ekranlar, sorgular ve dışa aktarım hep buradan geçer.
 *
 * Tarih kuralı: tarihler her yerde 'YYYY-MM-DD' dizesidir. Date nesnesi
 * yalnızca gün aritmetiği için, o da UTC üzerinden kullanılır — yerel saat
 * dilimi hiçbir hesaba karışmaz (CLAUDE.md kural 4).
 */

export type Halka = 'İÇ' | 'ORTA' | 'DIŞ'
export type Durum = 'KAYIT_YOK' | 'GECIKTI' | 'YAKLASIYOR' | 'GUNCEL'

export const YONTEMLER = [
  'Telefon',
  'Yüz yüze',
  'Mesaj',
  'E-posta',
  'Sosyal medya',
  'Diğer',
] as const
export type Yontem = (typeof YONTEMLER)[number]

export const HALKALAR: Halka[] = ['İÇ', 'ORTA', 'DIŞ']

/**
 * Başlangıç kategorileri.
 *
 * Bunlar yalnızca VARSAYILAN. Geçerli kategori listesi `ayarlar.kategoriler`
 * sütunundan gelir ve Ayarlar ekranından düzenlenir — kodda sabit değildir.
 * Bu dizi sadece migration çalışmamışsa geri düşülecek değer.
 */
export const VARSAYILAN_KATEGORILER = [
  'Kişisel',
  'Müşteriler',
  'Potansiyel Müşteriler',
  'Önemli İş Arkadaşları',
  'Tanışmak İstediklerim',
]

export const HEDEF_DURUMLARI = [
  'Araştırma',
  'İlk Temas Yapıldı',
  'Görüşme Ayarlandı',
  'Tanıştım',
] as const

/** Durum eşiği: sonraki temasa bu kadar gün kala "YAKLAŞIYOR" olur (SPEC §4). */
export const YAKLASIM_ESIGI_GUN = 7

export interface Kisi {
  id: string
  ad: string
  halka: Halka | null
  kategori: string | null
  frekans: number | null
  ozel_aralik_gun: number | null
  rol: string | null
  sirket: string | null
  sektor: string | null
  sehir: string | null
  telefon: string | null
  eposta: string | null
  profil_baglantisi: string | null
  kisisel_detay: string | null
  yapilacak_hamle: string | null
  notlar: string | null
  arsiv: boolean
  created_at?: string
  updated_at?: string
}

export interface Temas {
  id: string
  kisi_id: string
  tarih: string // YYYY-MM-DD
  yontem: Yontem | null
  ofis_disi_yuz_yuze: boolean
  not: string | null
  iptal: boolean
  created_at?: string
}

export interface Ayarlar {
  frekans_1_gun: number
  frekans_2_gun: number
  frekans_3_gun: number
  frekans_4_gun: number
  frekans_5_gun: number
  /** Kişi kategorileri — Ayarlar ekranından düzenlenir. */
  kategoriler: string[]
}

export const VARSAYILAN_AYARLAR: Ayarlar = {
  frekans_1_gun: 14,
  frekans_2_gun: 30,
  frekans_3_gun: 60,
  frekans_4_gun: 90,
  frekans_5_gun: 120,
  kategoriler: VARSAYILAN_KATEGORILER,
}

/** Seçilebilir frekanslar. Gün karşılıkları Ayarlar'dan değiştirilir. */
export const FREKANSLAR = [1, 2, 3, 4, 5] as const

/** Bir frekansın Ayarlar'daki gün sütunu. */
export function frekansGun(frekans: number, ayarlar: Ayarlar): number {
  switch (frekans) {
    case 1: return ayarlar.frekans_1_gun
    case 2: return ayarlar.frekans_2_gun
    case 3: return ayarlar.frekans_3_gun
    case 4: return ayarlar.frekans_4_gun
    case 5: return ayarlar.frekans_5_gun
    default: return ayarlar.frekans_3_gun
  }
}

/* ------------------------------------------------------------------ tarih */

const TARIH_KALIBI = /^(\d{4})-(\d{2})-(\d{2})$/

function utcGun(tarih: string): number {
  const eslesme = TARIH_KALIBI.exec(tarih)
  if (!eslesme) throw new Error(`Geçersiz tarih: "${tarih}" (YYYY-MM-DD bekleniyor)`)
  return Date.UTC(Number(eslesme[1]), Number(eslesme[2]) - 1, Number(eslesme[3]))
}

function gunuTarihe(msUtc: number): string {
  return new Date(msUtc).toISOString().slice(0, 10)
}

/** İki tarih arasındaki tam gün farkı (b - a). Negatifse b, a'dan öncedir. */
export function gunFarki(a: string, b: string): number {
  return Math.round((utcGun(b) - utcGun(a)) / 86_400_000)
}

/** Tarihe gün ekler; 'YYYY-MM-DD' döner. */
export function gunEkle(tarih: string, gun: number): string {
  return gunuTarihe(utcGun(tarih) + gun * 86_400_000)
}

/**
 * "Bugün" — Türkiye takvimine göre.
 * Sunucu UTC'de çalışsa bile kullanıcının gördüğü gün doğru olsun diye
 * saat dilimi açıkça Europe/Istanbul.
 */
export function bugun(simdi: Date = new Date()): string {
  // en-CA biçimi zaten YYYY-MM-DD üretir
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(simdi)
}

/** Ekranda gösterim: '2026-07-13' → '13 Tem 2026' */
export function tarihGoster(tarih: string | null | undefined): string {
  if (!tarih) return '—'
  const eslesme = TARIH_KALIBI.exec(tarih)
  if (!eslesme) return tarih
  const aylar = [
    'Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz',
    'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara',
  ]
  return `${Number(eslesme[3])} ${aylar[Number(eslesme[2]) - 1]} ${eslesme[1]}`
}

/* -------------------------------------------------------------- hesaplama */

/**
 * Temas aralığı (gün). Özel aralık varsa frekansı geçersiz kılar.
 *
 * Not: frekans atanmamışsa en gevşek ritim (frekans 3) varsayılır — kişi
 * hesaplamaların dışında kalmasın diye. Bu durum `frekansEksik` ile ayrıca
 * işaretlenir ki arayüz uyarabilsin.
 */
export function aralikGun(
  kisi: Pick<Kisi, 'frekans' | 'ozel_aralik_gun'>,
  ayarlar: Ayarlar,
): number {
  if (kisi.ozel_aralik_gun && kisi.ozel_aralik_gun > 0) return kisi.ozel_aralik_gun
  // Frekans atanmamışsa en gevşek varsayılan ritim (frekans 3) kullanılır
  return frekansGun(kisi.frekans ?? 3, ayarlar)
}

/** Son temasın üstüne aralığı ekler. Son temas yoksa null. */
export function sonrakiTemas(sonTemas: string | null, aralik: number): string | null {
  return sonTemas ? gunEkle(sonTemas, aralik) : null
}

/** SPEC §4 durum merdiveni. Sıra önemli. */
export function durumHesapla(sonraki: string | null, bugunTarih: string): Durum {
  if (!sonraki) return 'KAYIT_YOK'
  const kalan = gunFarki(bugunTarih, sonraki) // + ise gelecekte
  if (kalan < 0) return 'GECIKTI'
  if (kalan <= YAKLASIM_ESIGI_GUN) return 'YAKLASIYOR'
  return 'GUNCEL'
}

/** İptal edilmemiş temaslar — tüm sayımların girdisi. */
export function gecerliTemaslar(temaslar: Temas[]): Temas[] {
  return temaslar.filter((t) => !t.iptal)
}

/** 3 farklı yöntemle temas = karşı tarafın belleğine yerleşme (kitap s. 212). */
export function ucYontemTamam(temaslar: Temas[]): boolean {
  return yontemCesidi(temaslar) >= 3
}

export function yontemCesidi(temaslar: Temas[]): number {
  const kume = new Set<string>()
  for (const t of gecerliTemaslar(temaslar)) if (t.yontem) kume.add(t.yontem)
  return kume.size
}

/** Ofis dışında 2 yüz yüze = tanıdığın arkadaşa dönüşmesi (kitap s. 212). */
export function arkadasYolu(temaslar: Temas[]): boolean {
  return yuzYuzeSayisi(temaslar) >= 2
}

export function yuzYuzeSayisi(temaslar: Temas[]): number {
  return gecerliTemaslar(temaslar).filter((t) => t.ofis_disi_yuz_yuze).length
}

/** En son temas (tarihe göre; eşitlikte sonradan girilen kazanır). */
export function sonTemas(temaslar: Temas[]): Temas | null {
  let enSon: Temas | null = null
  for (const t of gecerliTemaslar(temaslar)) {
    if (!enSon) {
      enSon = t
      continue
    }
    if (t.tarih > enSon.tarih) enSon = t
    else if (t.tarih === enSon.tarih && (t.created_at ?? '') > (enSon.created_at ?? '')) enSon = t
  }
  return enSon
}

/* ------------------------------------------------------------------ özet */

export interface KisiOzet {
  kisi: Kisi
  sonTemasTarihi: string | null
  sonTemasYontemi: Yontem | null
  aralikGun: number
  sonrakiTemas: string | null
  /** Bugüne göre kalan gün. Negatif = gecikme. Son temas yoksa null. */
  kalanGun: number | null
  durum: Durum
  temasSayisi: number
  yontemCesidi: number
  ucYontemTamam: boolean
  yuzYuzeSayisi: number
  arkadasYolu: boolean
  /** Frekans atanmamış — varsayılan (frekans 3) ile hesaplandı. */
  frekansEksik: boolean
}

/** Bir kişinin tüm hesaplanan alanlarını tek seferde üretir. */
export function kisiOzet(
  kisi: Kisi,
  temaslar: Temas[],
  ayarlar: Ayarlar,
  bugunTarih: string,
): KisiOzet {
  const gecerli = gecerliTemaslar(temaslar)
  const son = sonTemas(gecerli)
  const aralik = aralikGun(kisi, ayarlar)
  const sonraki = sonrakiTemas(son?.tarih ?? null, aralik)

  return {
    kisi,
    sonTemasTarihi: son?.tarih ?? null,
    sonTemasYontemi: son?.yontem ?? null,
    aralikGun: aralik,
    sonrakiTemas: sonraki,
    kalanGun: sonraki ? gunFarki(bugunTarih, sonraki) : null,
    durum: durumHesapla(sonraki, bugunTarih),
    temasSayisi: gecerli.length,
    yontemCesidi: yontemCesidi(gecerli),
    ucYontemTamam: ucYontemTamam(gecerli),
    yuzYuzeSayisi: yuzYuzeSayisi(gecerli),
    arkadasYolu: arkadasYolu(gecerli),
    frekansEksik: kisi.frekans == null && kisi.ozel_aralik_gun == null,
  }
}

/** Aciliyet sırası: en çok geciken en üstte, kaydı olmayanlar en sonda. */
export function aciliyetSirasi(a: KisiOzet, b: KisiOzet): number {
  if (a.kalanGun === null && b.kalanGun === null) return 0
  if (a.kalanGun === null) return 1
  if (b.kalanGun === null) return -1
  return a.kalanGun - b.kalanGun
}

/* -------------------------------------------------------------- etiketler */

export const DURUM_ETIKET: Record<Durum, string> = {
  KAYIT_YOK: '⚠ KAYIT YOK',
  GECIKTI: 'GECİKTİ',
  YAKLASIYOR: 'YAKLAŞIYOR',
  GUNCEL: 'GÜNCEL',
}

export const DURUM_SIRASI: Durum[] = ['GECIKTI', 'YAKLASIYOR', 'GUNCEL', 'KAYIT_YOK']

/** "3 gün gecikti" / "5 gün kaldı" gibi insan okunur ifade. */
export function kalanGunGoster(kalanGun: number | null): string {
  if (kalanGun === null) return 'temas kaydı yok'
  if (kalanGun < 0) return `${Math.abs(kalanGun)} gün gecikti`
  if (kalanGun === 0) return 'bugün'
  return `${kalanGun} gün kaldı`
}
