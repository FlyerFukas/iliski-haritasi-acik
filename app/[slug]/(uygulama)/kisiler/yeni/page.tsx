import Link from 'next/link'
import { ayarlariGetir } from '@/lib/sorgular'
import LinkedinPdf from '../../LinkedinPdf'
import YeniKisiFormu from './YeniKisiFormu'

export const dynamic = 'force-dynamic'

export default async function YeniKisiSayfasi({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const ayarlar = await ayarlariGetir()

  return (
    <div className="yigin">
      <div className="satir">
        <Link href={`/${slug}/kisiler`} className="btn btn-kucuk">
          ← Kişiler
        </Link>
      </div>

      <h1>Yeni kişi</h1>

      {/* K-02: en hızlı yol, LinkedIn PDF'inden tüm bilgilerle ekle */}
      <LinkedinPdf slug={slug} acik baslik="LinkedIn PDF’inden ekle (önerilen)" />

      <p className="soluk" style={{ margin: 0 }}>
        ya da elle:
      </p>

      <YeniKisiFormu slug={slug} ayarlar={ayarlar} />
    </div>
  )
}
