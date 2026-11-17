import Link from 'next/link'
import LinkedinPdf from '../LinkedinPdf'
import CsvAktar from './CsvAktar'

export const dynamic = 'force-dynamic'
// Yüzlerce bağlantı tek seferde işlenebilir
export const maxDuration = 60

/** K-02: LinkedIn bağlantılarını (Connections.csv) toplu aktarma. */
export default async function LinkedinSayfasi({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return (
    <div className="yigin">
      <div className="satir">
        <Link href={`/${slug}/kisiler`} className="btn btn-kucuk">
          ← Kişiler
        </Link>
      </div>
      <div>
        <h1>LinkedIn’den aktar</h1>
        <p className="soluk" style={{ margin: '4px 0 0' }}>
          <strong>Tek kişi:</strong> profil PDF’ini yükle; kayıtlıysa bulunur, değilse yeni kişi
          olarak eklenir. <strong>Toplu:</strong> bağlantılarının şirket, pozisyon, LinkedIn adresi ve (paylaştıysa) e-postası, kayıtlı
          kişilerinle eşleştirilir. Önce rapor gelir; sen seçmedikçe hiçbir şey yazılmaz, dolu
          alanlar ezilmez, yeni kişi otomatik eklenmez.
        </p>
      </div>
      <LinkedinPdf slug={slug} acik baslik="Tek kişi: LinkedIn profil PDF’i" />

      <h2 style={{ margin: '8px 0 0' }}>Toplu: Connections.csv</h2>
      <details className="kart">
        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Connections.csv nasıl indirilir?</summary>
        <ol style={{ margin: '8px 0 0', paddingLeft: 20 }}>
          <li>LinkedIn → sağ üstte profil resmin → <strong>Ayarlar ve Gizlilik</strong></li>
          <li>
            <strong>Veri gizliliği</strong> → <strong>Verilerinin bir kopyasını al</strong>
          </li>
          <li>
            “İstediğin dosyaları seç” → yalnızca <strong>Bağlantılar</strong>’ı işaretle → İste
          </li>
          <li>Birkaç dakika içinde e-postayla gelen arşivi indir, içindeki <strong>Connections.csv</strong>’yi aşağıda seç</li>
        </ol>
      </details>
      <CsvAktar />
    </div>
  )
}
