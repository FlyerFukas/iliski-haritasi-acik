/**
 * Alan adı → Türkçe etiket.
 *
 * Ayrı dosyada, çünkü `lib/actions/kisi.ts` bir `'use server'` modülü ve
 * öyle dosyalar yalnızca async fonksiyon export edebilir — sabit bir nesne
 * export etmek çalışma zamanında hata verir.
 */
export const ALAN_ETIKET: Record<string, string> = {
  ad: 'Ad',
  halka: 'Halka',
  kategori: 'Kategori',
  frekans: 'Frekans',
  ozel_aralik_gun: 'Özel aralık (gün)',
  rol: 'Rol / bağlam',
  sirket: 'Şirket',
  sektor: 'Sektör',
  sehir: 'Şehir',
  telefon: 'Telefon',
  eposta: 'E-posta',
  profil_baglantisi: 'LinkedIn profili',
  kisisel_detay: 'Kişisel detay',
  yapilacak_hamle: 'Yapılacak hamle',
  notlar: 'Notlar',
  arsiv: 'Arşiv',
  gecmis: 'Geçmiş',
  kaynak: 'Kaynak',
}
