/**
 * Sunucu eyleminin FIRLATTIGI hatayi ekranda gosterilecek cumleye cevirir (istemci tarafi).
 *
 * Next.js canlida (production) firlatilan hatanin metnini gizler; istemciye
 * "An error occurred in the Server Components render..." diye Ingilizce bir
 * genel mesaj ve `digest` alani gelir. Bu metin kullaniciya bir sey soylemez
 * ve "Kullaniciya Ingilizce metin gosterme" kuralini bozar. Gelistirmede metin
 * gizlenmez; o zaman eylemin kendi Turkce mesaji aynen gosterilir.
 *
 * Kalici cozum eylemlerin `throw` yerine `{ hata }` dondurmesi (HANDOFF'ta not).
 */
export function istemciHataMetni(e: unknown): string {
  const gizli = typeof e === 'object' && e !== null && 'digest' in e
  const metin = e instanceof Error ? e.message : ''
  if (gizli || !metin || /Server Components render|omitted in production/i.test(metin)) {
    return 'İşlem tamamlanamadı. Sayfayı yenileyip tekrar dene; girdiğin bilgi kaybolmaz.'
  }
  return metin
}
