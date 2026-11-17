import Link from 'next/link'
import { Suspense } from 'react'
import { DURUM_ETIKET, kalanGunGoster } from '@/lib/hesaplama'
import { anlikDurum, benzersizDegerler } from '@/lib/sorgular'
import { suz, suzgecOku } from '@/lib/suzme'
import CagriSuzgec from './CagriSuzgec'

export const dynamic = 'force-dynamic'

export default async function CagriListesiSayfasi({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { slug } = await params
  const sorgu = await searchParams
  const suzgec = suzgecOku(sorgu)

  const { ozetler } = await anlikDurum()
  let sonuc = suz(ozetler, suzgec)

  if (sorgu.telefonlu === '1') sonuc = sonuc.filter((o) => o.kisi.telefon)

  return (
    <div className="yigin">
      <div>
        <h1>Çağrı listesi</h1>
        <p className="soluk" style={{ margin: '4px 0 0' }}>
          Şehre veya sektöre göre süz, numaraya dokun, ara.
        </p>
      </div>

      <Suspense fallback={<div className="kart soluk">Filtreler yükleniyor…</div>}>
        <CagriSuzgec
          sehirler={benzersizDegerler(ozetler, 'sehir')}
          sektorler={benzersizDegerler(ozetler, 'sektor')}
          sonucSayisi={sonuc.length}
          telefonluSayisi={ozetler.filter((o) => o.kisi.telefon).length}
        />
      </Suspense>

      {sonuc.length === 0 ? (
        <div className="kart bos-durum">Bu filtrelerle eşleşen kişi yok.</div>
      ) : (
        <div className="yigin" style={{ gap: 10 }}>
          {sonuc.map((o) => (
            <div key={o.kisi.id} className="kart">
              <div className="satir">
                <Link href={`/${slug}/kisiler/${o.kisi.id}`} style={{ fontWeight: 650 }}>
                  {o.kisi.ad}
                </Link>
                <span className={`rozet rozet-${o.durum}`}>
                  {DURUM_ETIKET[o.durum].replace('⚠ ', '')}
                </span>
                <span className="aralik" />
                <span className="soluk">{kalanGunGoster(o.kalanGun)}</span>
              </div>

              <div className="soluk" style={{ marginTop: 4 }}>
                {[o.kisi.rol, o.kisi.sirket, o.kisi.sehir, o.kisi.sektor]
                  .filter(Boolean)
                  .join(' · ') || '—'}
              </div>

              {o.kisi.yapilacak_hamle ? (
                <p style={{ margin: '8px 0 0' }}>{o.kisi.yapilacak_hamle}</p>
              ) : null}

              <div className="satir" style={{ marginTop: 10 }}>
                {o.kisi.telefon ? (
                  <a href={`tel:${o.kisi.telefon}`} className="btn btn-birincil btn-kucuk">
                    📞 {o.kisi.telefon}
                  </a>
                ) : (
                  <span className="soluk">telefon kayıtlı değil</span>
                )}
                {o.kisi.eposta ? (
                  <a href={`mailto:${o.kisi.eposta}`} className="btn btn-kucuk">
                    ✉️ E-posta
                  </a>
                ) : null}
                <span className="aralik" />
                <Link href={`/${slug}/temas?kisi=${o.kisi.id}`} className="btn btn-kucuk">
                  Temas ekle
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
