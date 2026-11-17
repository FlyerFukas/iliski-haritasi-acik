import { cikisYap } from '@/lib/actions/oturum'
import { anlikDurum, kullanilanKategoriler } from '@/lib/sorgular'
import AyarFormu from './AyarFormu'
import KategoriYonetimi from './KategoriYonetimi'
import KurulumDugmesi from './KurulumDugmesi'

export const dynamic = 'force-dynamic'

export default async function AyarlarSayfasi({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const { ozetler, ayarlar } = await anlikDurum(true)

  const arsivdeki = ozetler.filter((o) => o.kisi.arsiv).length
  const temasToplam = ozetler.reduce((t, o) => t + o.temasSayisi, 0)

  // Hangi kategori kaç kişide kullanılıyor — çıkarmadan önce uyarabilmek için
  const kullanim: Record<string, number> = {}
  for (const o of ozetler) {
    if (o.kisi.kategori) kullanim[o.kisi.kategori] = (kullanim[o.kisi.kategori] ?? 0) + 1
  }

  return (
    <div className="yigin">
      <h1>Ayarlar</h1>

      <KurulumDugmesi />

      <AyarFormu ayarlar={ayarlar} />

      {/* Kullanımdaki ama listede olmayan kategoriler de görünsün — 0002
          migration çalışmadan önce liste varsayılana düşüyor ve elle
          girilmiş kategoriler kaybolmuş gibi görünürdü. */}
      <KategoriYonetimi
        kategoriler={kullanilanKategoriler(ayarlar, ozetler)}
        kullanim={kullanim}
      />

      <section className="kart yigin">
        <div className="kart-baslik">
          <h2>Yedek al</h2>
        </div>
        <p className="soluk" style={{ margin: 0 }}>
          Ana sistem artık bu uygulama. Excel yedeği alışık olduğun beş sayfayla
          iner; JSON yedeği <code>npm run seed</code> ile geri yüklenebilir.
        </p>

        <a href={`/${slug}/disa-aktar/excel`} className="btn btn-genis" download>
          📊 Excel olarak indir (.xlsx)
          <span className="soluk">— 5 sayfa, tam yedek</span>
        </a>

        <a href={`/${slug}/disa-aktar/csv`} className="btn btn-genis" download>
          📄 Ana Liste — CSV indir
          <span className="soluk">— tek sayfa, her yerde açılır</span>
        </a>

        <a href={`/${slug}/disa-aktar/json`} className="btn btn-genis" download>
          🗄️ JSON yedek indir
          <span className="soluk">— geri yüklenebilir</span>
        </a>
      </section>

      <section className="kart">
        <div className="kart-baslik">
          <h2>Durum</h2>
        </div>
        <div className="izgara">
          <div>
            <div className="sayac-rakam">{ozetler.length}</div>
            <div className="soluk">kişi (arşiv dahil)</div>
          </div>
          <div>
            <div className="sayac-rakam">{temasToplam}</div>
            <div className="soluk">temas kaydı</div>
          </div>
          <div>
            <div className="sayac-rakam">{arsivdeki}</div>
            <div className="soluk">arşivde</div>
          </div>
        </div>
      </section>

      <form action={cikisYap}>
        <button type="submit" className="btn btn-genis">
          Çıkış yap
        </button>
      </form>
    </div>
  )
}
