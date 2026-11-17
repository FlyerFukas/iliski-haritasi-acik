import { HEDEF_DURUMLARI } from '@/lib/hesaplama'
import { supabaseSunucu } from '@/lib/supabase'
import HedefEkle from './HedefEkle'
import HedefKarti, { type Hedef } from './HedefKarti'

export const dynamic = 'force-dynamic'

export default async function HedeflerSayfasi({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  const db = supabaseSunucu()
  const { data, error } = await db
    .from('hedefler')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Hedefler okunamadı: ${error.message}`)
  const hedefler = (data ?? []) as Hedef[]

  const sayac = (durum: string) => hedefler.filter((h) => h.durum === durum).length

  return (
    <div className="yigin">
      <div>
        <h1>Tanışmak istediklerim</h1>
        <p className="soluk" style={{ margin: '4px 0 0' }}>
          Ferrazzi&apos;nin hedef listesi: bir gün tanışmak istediğin kişiler.
        </p>
      </div>

      {hedefler.length > 0 ? (
        <div className="satir">
          {HEDEF_DURUMLARI.map((d) => (
            <span key={d} className="rozet rozet-notr">
              {d}: {sayac(d)}
            </span>
          ))}
        </div>
      ) : null}

      <HedefEkle />

      {hedefler.length === 0 ? (
        <div className="kart bos-durum">
          <p>Henüz hedef yok.</p>
          <p className="soluk">
            Tanışmak istediğin birini yukarıdan ekle — kimin aracılığıyla
            ulaşacağını ve ilk teması nasıl kuracağını şimdiden yaz.
          </p>
        </div>
      ) : (
        <div className="yigin" style={{ gap: 10 }}>
          {hedefler.map((h) => (
            <HedefKarti key={h.id} hedef={h} slug={slug} />
          ))}
        </div>
      )}
    </div>
  )
}
