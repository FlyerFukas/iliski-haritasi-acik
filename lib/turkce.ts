/**
 * Türkçe metin yardımcıları (CLAUDE.md kural 5).
 *
 * JS'in yerleşik toLowerCase()'i Türkçe için bozuktur:
 *   'İ'.toLowerCase() === 'i̇'  (i + birleşen nokta, iki kod noktası)
 *   'I'.toLowerCase() === 'i'   (Türkçede 'ı' olmalı)
 * Bu yüzden eşleştirme yaparken harfleri elle katlıyoruz.
 */

// Eşleştirme için harf katlama tablosu. Amaç doğru Türkçe yazım değil,
// "aynı kişi mi?" sorusuna kararlı cevap vermek.
const KATLAMA: Record<string, string> = {
  İ: 'i', I: 'i', ı: 'i', i: 'i',
  Ş: 's', ş: 's',
  Ğ: 'g', ğ: 'g',
  Ü: 'u', ü: 'u',
  Ö: 'o', ö: 'o',
  Ç: 'c', ç: 'c',
  Â: 'a', â: 'a',
  Î: 'i', î: 'i',
  Û: 'u', û: 'u',
}

/**
 * Eşleştirme anahtarı üretir: harf katlama + küçültme + boşluk sadeleştirme.
 * "Ayşe  IŞIK" ve "ayse isik" aynı anahtarı verir.
 */
export function anahtar(metin: string | null | undefined): string {
  if (!metin) return ''
  let cikti = ''
  for (const harf of metin.normalize('NFC')) {
    cikti += KATLAMA[harf] ?? harf.toLowerCase()
  }
  return cikti
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // kalan birleşen işaretleri at
    .replace(/\s+/g, ' ')
    .trim()
}

/** `parca` metni `kaynak` içinde geçiyor mu — Türkçe duyarsız arama. */
export function icerir(kaynak: string | null | undefined, parca: string): boolean {
  const p = anahtar(parca)
  if (!p) return true
  return anahtar(kaynak).includes(p)
}

const harmanlayici = new Intl.Collator('tr', { sensitivity: 'base', numeric: true })

/** Türkçe alfabetik sıralama (Array.prototype.sort içinde kullanılır). */
export function sirala(a: string | null | undefined, b: string | null | undefined): number {
  return harmanlayici.compare(a ?? '', b ?? '')
}

/** Türkçe büyük harf ('i' → 'İ', 'ı' → 'I'). */
export function buyuk(metin: string): string {
  return metin.replace(/i/g, 'İ').replace(/ı/g, 'I').toLocaleUpperCase('tr-TR')
}
