import Link from 'next/link'
import LinkedinSimge from '../LinkedinSimge'
import { Suspense } from 'react'
import { DURUM_ETIKET, kalanGunGoster, tarihGoster, type KisiOzet } from '@/lib/hesaplama'
import { anlikDurum, ayarlariGetir, benzersizDegerler, kullanilanKategoriler } from '@/lib/sorgular'
import { etkinSuzgecSayisi, suz, suzgecOku } from '@/lib/suzme'
import Suzgecler from './Suzgecler'

export const dynamic = 'force-dynamic'

export default async function KisilerSayfasi({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { slug } = await params
  const sorgu = await searchParams
  const suzgec = suzgecOku(sorgu)

  const [{ ozetler }, ayarlar] = await Promise.all([
    anlikDurum(suzgec.arsiv),
    ayarlariGetir(),
  ])
  const sonuc = suz(ozetler, suzgec)

  return (
    <div className="yigin">
      <div className="satir">
        <h1>Kişiler</h1>
        <span className="aralik" />
        <Link href={`/${slug}/linkedin`} className="btn btn-kucuk" title="LinkedIn bağlantılarını toplu aktar">
          in Aktar
        </Link>
        <a
          href={`/${slug}/disa-aktar/csv`}
          className="btn btn-kucuk"
          download
          title="Ana listeyi CSV olarak indir"
        >
          📄 CSV
        </a>
      </div>

      {/* Ekleme düğmesi tam genişlikte ve yapışkan — mobilde kaydırınca da
          ekranda kalır, kaçırılması zor. */}
      <Link
        href={`/${slug}/kisiler/yeni`}
        className="btn btn-birincil btn-genis ekle-dugmesi"
      >
        + Yeni kişi ekle
      </Link>

      <Suspense fallback={<div className="kart soluk">Filtreler yükleniyor…</div>}>
        <Suzgecler
          sektorler={benzersizDegerler(ozetler, 'sektor')}
          sehirler={benzersizDegerler(ozetler, 'sehir')}
          kategoriler={kullanilanKategoriler(ayarlar, ozetler)}
          etkinSayi={etkinSuzgecSayisi(suzgec)}
          sonucSayisi={sonuc.length}
        />
      </Suspense>

      {sonuc.length === 0 ? (
        <div className="kart bos-durum yigin">
          <p style={{ margin: 0 }}>Bu filtrelerle eşleşen kişi yok.</p>
          <Link href={`/${slug}/kisiler/yeni`} className="btn btn-birincil">
            + Yeni kişi ekle
          </Link>
        </div>
      ) : (
        <>
          {/* geniş ekran: tablo */}
          <div className="kart sadece-genis" style={{ padding: 0 }}>
            <div className="tablo-sarmal">
              <table>
                <thead>
                  <tr>
                    <th>Ad</th>
                    <th>Halka</th>
                    <th>Frekans</th>
                    <th>Son temas</th>
                    <th>Sonraki temas</th>
                    <th>Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {sonuc.map((o) => (
                    <tr key={o.kisi.id}>
                      <td>
                        <Link href={`/${slug}/kisiler/${o.kisi.id}`}>{o.kisi.ad}</Link>{' '}
                        <LinkedinSimge adres={o.kisi.profil_baglantisi} boyut={14} />
                        {o.kisi.arsiv ? <span className="rozet rozet-notr">arşiv</span> : null}
                        {o.kisi.sirket ? <div className="soluk">{o.kisi.sirket}</div> : null}
                      </td>
                      <td>{o.kisi.halka ?? '—'}</td>
                      <td>{o.kisi.frekans ?? '—'}</td>
                      <td>{tarihGoster(o.sonTemasTarihi)}</td>
                      <td>{tarihGoster(o.sonrakiTemas)}</td>
                      <td>
                        <span className={`rozet rozet-${o.durum}`}>
                          {DURUM_ETIKET[o.durum].replace('⚠ ', '')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* dar ekran: yatay kaydırmalı kartlar */}
          <div className="yigin sadece-dar" style={{ gap: 10 }}>
            {sonuc.map((o) => (
              <KisiKarti key={o.kisi.id} ozet={o} slug={slug} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/**
 * Mobil kişi kartı.
 *
 * Sağa kaydırıldıkça kişisel detay, yapılacak hamle ve notlar görünür —
 * kişiye girmeden okunabilsin diye. Sadece dolu olan paneller gösterilir,
 * boş panel kaydırmayı gereksiz uzatmasın.
 */
function KisiKarti({ ozet, slug }: { ozet: KisiOzet; slug: string }) {
  const k = ozet.kisi

  const paneller: Array<{ baslik: string; icerik: string }> = []
  if (k.kisisel_detay) paneller.push({ baslik: 'Kişisel detay', icerik: k.kisisel_detay })
  if (k.yapilacak_hamle) paneller.push({ baslik: 'Yapılacak hamle', icerik: k.yapilacak_hamle })
  if (k.notlar) paneller.push({ baslik: 'Notlar', icerik: k.notlar })

  return (
    <div className="kart">
      <div className="kaydir">
        {/* 1. panel — özet */}
        <div className="kaydir-panel">
          <div className="satir">
            <Link
              href={`/${slug}/kisiler/${k.id}`}
              style={{ fontWeight: 650, color: 'inherit' }}
            >
              {k.ad}
            </Link>
            <LinkedinSimge adres={k.profil_baglantisi} boyut={16} />
            {k.arsiv ? <span className="rozet rozet-notr">arşiv</span> : null}
            <span className="aralik" />
            <span className={`rozet rozet-${ozet.durum}`}>
              {DURUM_ETIKET[ozet.durum].replace('⚠ ', '')}
            </span>
          </div>
          <div className="soluk" style={{ marginTop: 4 }}>
            {[k.rol, k.sirket].filter(Boolean).join(' · ') || '—'}
          </div>
          <div className="satir soluk" style={{ marginTop: 6, gap: 12 }}>
            <span>Son: {tarihGoster(ozet.sonTemasTarihi)}</span>
            <span>{kalanGunGoster(ozet.kalanGun)}</span>
          </div>
        </div>

        {/* devam panelleri */}
        {paneller.map((p) => (
          <div key={p.baslik} className="kaydir-panel">
            <div className="etiket">{p.baslik}</div>
            <p style={{ margin: '4px 0 0', fontSize: '0.9rem' }}>{p.icerik}</p>
          </div>
        ))}
      </div>

      {paneller.length > 0 ? (
        <div className="kaydir-ipucu">
          {[0, ...paneller.map((_, i) => i + 1)].map((i) => (
            <span key={i} className="kaydir-nokta" />
          ))}
          <span>
            kaydır → {paneller.map((p) => p.baslik.toLocaleLowerCase('tr')).join(', ')}
          </span>
        </div>
      ) : null}
    </div>
  )
}
