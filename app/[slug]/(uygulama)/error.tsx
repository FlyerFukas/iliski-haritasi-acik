'use client'

/**
 * Sunucu tarafında hata olursa Next'in "Application error" ekranı yerine
 * bu gösterilir. En sık sebep: Supabase ücretsiz planı 7 gün kullanılmayan
 * projeyi uyutur, adresi DNS'ten kalkar ve her sorgu düşer.
 */
export default function Hata({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="kart yigin" style={{ marginTop: 24 }}>
      <h1>Veriye ulaşılamıyor</h1>
      <p style={{ margin: 0 }}>
        Uygulama çalışıyor ama veritabanına bağlanamadı. En olası sebep:
        Supabase projesi uzun süre kullanılmadığı için uyutuldu.
      </p>
      <p className="soluk" style={{ margin: 0 }}>
        Supabase panelinde projeyi açıp &quot;Restore project&quot; düğmesine bas,
        1-3 dakika bekle, sonra bu sayfayı yenile. Verin silinmedi.
      </p>
      <button type="button" className="btn btn-birincil btn-genis" onClick={reset}>
        Tekrar dene
      </button>
    </div>
  )
}
