/**
 * K-01: LinkedIn profil adresi doğrulama ve normalleştirme — TEK KAYNAK.
 *
 * "linkedin.com/in/ad-soyad", "https://tr.linkedin.com/in/ad-soyad/?utm=x"
 * ve "www.linkedin.com/in/Ad-Soyad" aynı adrese düşer:
 *   https://www.linkedin.com/in/ad-soyad
 */

export type LinkedinSonuc =
  | { tamam: true; adres: string; kimlik: string }
  | { tamam: false; hata: string }

const PROFIL_KALIBI = /^(?:[a-z]{2,3}\.|www\.|m\.)?linkedin\.com\/(in|pub)\/([^/?#\s]+)/i

export function linkedinNormalize(ham: string | null | undefined): LinkedinSonuc | null {
  const metin = (ham ?? '').trim()
  if (!metin) return null

  const sade = metin.replace(/^https?:\/\//i, '').replace(/^\/+/, '')
  const eslesme = sade.match(PROFIL_KALIBI)
  if (!eslesme) {
    if (/linkedin\.com/i.test(sade)) {
      return {
        tamam: false,
        hata: 'Bu bir LinkedIn kişi profili adresi değil. Adres "linkedin.com/in/..." biçiminde olmalı (şirket sayfası ya da gönderi adresi değil).',
      }
    }
    return { tamam: false, hata: 'LinkedIn adresi değil. Örnek: https://www.linkedin.com/in/ad-soyad' }
  }

  let kimlik = eslesme[2]
  try {
    kimlik = decodeURIComponent(kimlik)
  } catch {
    // bozuk yüzde kodlaması: olduğu gibi bırak
  }
  kimlik = kimlik.toLowerCase()
  return { tamam: true, kimlik, adres: `https://www.linkedin.com/in/${encodeURIComponent(kimlik)}` }
}

/** Kişi kartı/listesi için: geçerli bir LinkedIn adresi mi? */
export function linkedinMi(adres: string | null | undefined): boolean {
  return linkedinNormalize(adres)?.tamam === true
}
