/**
 * öğrenme motoru çıktılarının (beyin_cikti) türleri ve ekranda Türkçe gösterimi.
 * Hesap ayrı, kapalı kaynak öğrenme motorunda; burada yalnız okunur ve biçimlenir.
 */

export interface BeyinNeden {
  etiket: string
  skor: number
  neden: [string, number][]
}

export interface KisiBeyin {
  iliskili_kisiler: { kisi_id: string; skor: number; neden: [string, number][] }[]
  iliskili_ozellikler: BeyinNeden[]
  sonraki: { etiket: string; skor: number; dayanak: [string, number, number][] }[]
}

export interface GenelBeyin {
  motor_surumu: string
  ozet: { kayit: number; noron: number; sinaps: number; uyarici: number; inhibitor: number }
  arkadas_yolu: { etiket: string; w: number }[]
  varsayim_istatistik?: { uretilen: number; acik: number; dogrulanan: number; reddedilen: number }
  varsayimlar?: { kaynak: string; hedef: string; skor: number; ara?: string }[]
}

const SUTUN: Record<string, string> = {
  halka: 'Halka',
  kategori: 'Kategori',
  frekans: 'Frekans',
  sektor: 'Sektör',
  sehir: 'Şehir',
  sirket: 'Şirket',
  kurum: 'Kurum',
  kurum_turu: 'Kurum türü',
  bolum: 'Bölüm',
  yontem: 'Temas yöntemi',
}

const KURUM_TURU: Record<string, string> = {
  sirket: 'şirket', universite: 'üniversite', okul: 'okul', vakif: 'vakıf',
  dernek: 'dernek', topluluk: 'topluluk', kamu: 'kamu', diger: 'diğer',
}

/** "sektor=telekom" → "Sektör: telekom"; "kisi_id=<uuid>" → kişinin adı. */
export function etiketGoster(etiket: string, adlar?: Map<string, string>): string {
  if (etiket.startsWith('sonuç:')) return 'Arkadaş yolu (ofis dışı yüz yüze)'
  const m = etiket.match(/^([^=∈~]+)([=∈~])(.*)$/)
  if (!m) return etiket
  const [, sutun, , deger] = m
  if (sutun === 'kisi_id') return adlar?.get(deger) ?? 'bir kişi'
  if (sutun === 'kurum_turu') return `Kurum türü: ${KURUM_TURU[deger] ?? deger}`
  if (sutun.startsWith('zaman:')) return `Zaman: ${deger}`
  return `${SUTUN[sutun] ?? sutun}: ${deger}`
}
