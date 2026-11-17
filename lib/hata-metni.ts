/**
 * Beklenmeyen veritabanı hatasını kullanıcıya gösterilecek cümleye çevirir.
 *
 * Bilinen kodlar (23505 aynı ad, 23514 kısıt) çağıran yerde zaten ayrı karşılanıyor;
 * buraya düşen hata beklenmeyendir. Ham metin ("violates foreign key constraint ...")
 * kullanıcıya bir şey söylemez, ekrana değil sunucu günlüğüne yazılır (Vercel → Logs).
 * Kullanıcı ne olduğunu ve ne yapacağını görür (erişilebilirlik B12, B08).
 */
export function beklenmeyenHata(ne: string, error: { message?: string; code?: string } | null | undefined): string {
  console.error(`[${ne}]`, error?.code ?? '', error?.message ?? error)
  const baglanti = /fetch failed|network|timeout|ECONN/i.test(error?.message ?? '')
  return baglanti
    ? `${ne}: sunucuya ulaşılamadı. İnternet bağlantını kontrol edip tekrar dene.`
    : `${ne}. Tekrar dene; sorun sürerse sayfayı yenile, girdiğin bilgi kaybolmaz.`
}
