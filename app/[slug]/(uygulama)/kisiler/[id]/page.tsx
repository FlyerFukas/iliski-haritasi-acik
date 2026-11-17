import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ALAN_ETIKET } from '@/lib/etiketler'
import {
  DURUM_ETIKET,
  bugun,
  kalanGunGoster,
  kisiOzet,
  tarihGoster,
} from '@/lib/hesaplama'
import {
  ayarlariGetir,
  beyinCiktisi,
  degisiklikGecmisi,
  gecmisVerisi,
  kisiGetir,
  kisileriGetir,
  kisiTemaslari,
} from '@/lib/sorgular'
import { KURUM_TURU_ETIKET, baglariHesapla, kisininBaglari, metindenKurum } from '@/lib/ortak-nokta'
import TemasFormu from '../../temas/TemasFormu'
import ArsivDugmesi from './ArsivDugmesi'
import LinkedinPdf from '../../LinkedinPdf'
import LinkedinSimge from '../../LinkedinSimge'
import BeyinBolumu from './BeyinBolumu'
import GecmisBolumu from './GecmisBolumu'
import type { KisiBeyin } from '@/lib/beyin'
import KisiDuzenle from './KisiDuzenle'

export const dynamic = 'force-dynamic'

export default async function KisiDetay({
  params,
}: {
  params: Promise<{ slug: string; id: string }>
}) {
  const { slug, id } = await params

  const kisi = await kisiGetir(id)
  if (!kisi) notFound()

  const [temaslar, ayarlar, gecmis, gv, herkes, beyin] = await Promise.all([
    kisiTemaslari(id),
    ayarlariGetir(),
    degisiklikGecmisi(id),
    gecmisVerisi(),
    kisileriGetir(),
    beyinCiktisi<KisiBeyin>(`kisi:${id}`),
  ])

  // K-04: geçmiş kayıtları ve ortak noktalar (lib/ortak-nokta.ts tek kaynak)
  const kurumHaritasi = new Map(gv.kurumlar.map((k) => [k.id, k]))
  const gecmisSatirlari = gv.gecmis
    .filter((g) => g.kisi_id === id)
    .map((g) => {
      const k = kurumHaritasi.get(g.kurum_id)
      return {
        id: g.id,
        kurumAdi: k?.ad ?? '?',
        kurumTuru: k?.tur ?? 'diger',
        alan: g.alan,
        baslangic_yil: g.baslangic_yil,
        bitis_yil: g.bitis_yil,
        guncel: g.guncel,
        kaynak: g.not?.startsWith('kaynak: LinkedIn') ? 'LinkedIn' : null,
      }
    })
  const metinKurum = metindenKurum(kisi.sirket)
  const kisininKurumlari = new Set(
    gv.gecmis.filter((g) => g.kisi_id === id).map((g) => kurumHaritasi.get(g.kurum_id)?.anahtar),
  )
  const oneri = metinKurum && !kisininKurumlari.has(metinKurum.anahtar) ? metinKurum.ad : null
  const kisiListesi = herkes.some((k) => k.id === kisi.id) ? herkes : [...herkes, kisi]
  const adlar = new Map(kisiListesi.map((k) => [k.id, k.ad]))
  const ortaklar = kisininBaglari(id, baglariHesapla(kisiListesi, gv.gecmis, gv.kurumlar))

  const bugunTarih = bugun()
  const ozet = kisiOzet(kisi, temaslar, ayarlar, bugunTarih)

  return (
    <div className="yigin">
      <div className="satir">
        <Link href={`/${slug}/kisiler`} className="btn btn-kucuk">
          ← Kişiler
        </Link>
        <span className="aralik" />
        <ArsivDugmesi id={kisi.id} arsivde={kisi.arsiv} />
      </div>

      <div>
        <h1>
          {kisi.ad} <LinkedinSimge adres={kisi.profil_baglantisi} boyut={22} />
        </h1>
        <p className="soluk" style={{ margin: '4px 0 0' }}>
          {[kisi.rol, kisi.sirket, kisi.sehir].filter(Boolean).join(' · ') || '—'}
        </p>
      </div>

      {/* rozetler */}
      <div className="satir">
        <span className={`rozet rozet-${ozet.durum}`}>{DURUM_ETIKET[ozet.durum]}</span>
        <span className="rozet rozet-notr">{kalanGunGoster(ozet.kalanGun)}</span>
        <span className="rozet rozet-notr">{ozet.temasSayisi} temas</span>
        <span className={ozet.ucYontemTamam ? 'rozet rozet-GUNCEL' : 'rozet rozet-notr'}>
          {ozet.ucYontemTamam ? '✓ 3 YÖNTEM' : `${ozet.yontemCesidi}/3 yöntem`}
        </span>
        <span className={ozet.arkadasYolu ? 'rozet rozet-GUNCEL' : 'rozet rozet-notr'}>
          {ozet.arkadasYolu ? '✓ ARKADAŞ' : `${ozet.yuzYuzeSayisi}/2 ofis dışı`}
        </span>
        {kisi.arsiv ? <span className="rozet rozet-notr">arşivde</span> : null}
      </div>

      {ozet.frekansEksik ? (
        <p className="hata">
          Frekans atanmamış — hesaplar en gevşek ritme ({ayarlar.frekans_3_gun} gün) göre
          yapılıyor. Aşağıdan bir frekans seç.
        </p>
      ) : null}

      {/* hızlı bilgiler */}
      <div className="kart">
        <div className="izgara">
          <div>
            <div className="etiket">Son temas</div>
            <div>
              {tarihGoster(ozet.sonTemasTarihi)}
              {ozet.sonTemasYontemi ? (
                <span className="soluk"> · {ozet.sonTemasYontemi}</span>
              ) : null}
            </div>
          </div>
          <div>
            <div className="etiket">Sonraki temas</div>
            <div>{tarihGoster(ozet.sonrakiTemas)}</div>
          </div>
          {kisi.telefon ? (
            <div>
              <div className="etiket">Telefon</div>
              <a href={`tel:${kisi.telefon}`}>{kisi.telefon}</a>
            </div>
          ) : null}
          {kisi.eposta ? (
            <div>
              <div className="etiket">E-posta</div>
              <a href={`mailto:${kisi.eposta}`}>{kisi.eposta}</a>
            </div>
          ) : null}
        </div>

        {kisi.yapilacak_hamle ? (
          <div style={{ marginTop: 14 }}>
            <div className="etiket">Yapılacak hamle</div>
            <p style={{ margin: '2px 0 0' }}>{kisi.yapilacak_hamle}</p>
          </div>
        ) : null}
      </div>

      {/* temas ekle */}
      <details>
        <summary className="btn btn-birincil btn-genis" style={{ listStyle: 'none' }}>
          + Bu kişiye temas ekle
        </summary>
        <div style={{ marginTop: 12 }}>
          <TemasFormu
            kisiler={[
              {
                id: kisi.id,
                ad: kisi.ad,
                sirket: kisi.sirket,
                halka: kisi.halka,
                kalanGun: ozet.kalanGun,
              },
            ]}
            bugun={bugunTarih}
            secili={{
              id: kisi.id,
              ad: kisi.ad,
              sirket: kisi.sirket,
              halka: kisi.halka,
              kalanGun: ozet.kalanGun,
            }}
          />
        </div>
      </details>

      {/* temas geçmişi */}
      <section className="kart">
        <div className="kart-baslik">
          <h2>Temas geçmişi</h2>
          <span className="aralik" />
          <span className="soluk">{temaslar.length} kayıt</span>
        </div>

        {temaslar.length === 0 ? (
          <p className="bos-durum">Henüz temas kaydı yok.</p>
        ) : (
          <ul className="cizelge">
            {temaslar.map((t) => (
              <li key={t.id} className={t.iptal ? 'iptal-edilmis' : undefined}>
                <div className="satir">
                  <strong>{tarihGoster(t.tarih)}</strong>
                  <span className="rozet rozet-notr">{t.yontem ?? '—'}</span>
                  {t.ofis_disi_yuz_yuze ? (
                    <span className="rozet rozet-GUNCEL">ofis dışı</span>
                  ) : null}
                  {t.iptal ? <span className="rozet rozet-GECIKTI">iptal</span> : null}
                </div>
                {t.not ? <p style={{ margin: '4px 0 0' }}>{t.not}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <GecmisBolumu
        kisiId={kisi.id}
        satirlar={gecmisSatirlari}
        kurumlar={gv.kurumlar.map((k) => ({ ad: k.ad, tur: k.tur }))}
        oneri={oneri}
        semaVar={gv.semaVar}
      />

      {gv.semaVar ? <LinkedinPdf slug={slug} kisiId={kisi.id} /> : null}

      {/* ortak noktalar */}
      <section className="kart">
        <div className="kart-baslik">
          <h2>Ortak noktaları olanlar</h2>
          <span className="aralik" />
          <Link href={`/${slug}/ag?kisi=${kisi.id}`} className="btn btn-kucuk">
            Ağda göster
          </Link>
        </div>
        {ortaklar.length === 0 ? (
          <p className="bos-durum">
            Henüz ortak nokta bulunamadı. Geçmiş ekledikçe (okul, bölüm, şirket, vakıf)
            bağlantılar burada çıkar.
          </p>
        ) : (
          <ul className="cizelge">
            {ortaklar.map(({ digerId, bag }) => (
              <li key={digerId}>
                <div className="satir">
                  <Link href={`/${slug}/kisiler/${digerId}`}>
                    <strong>{adlar.get(digerId)}</strong>
                  </Link>
                  <span className="aralik" />
                  <span className="rozet rozet-notr">güç {bag.guc}</span>
                </div>
                {bag.noktalar.map((n, i) => (
                  <p key={i} className={n.kesin ? undefined : 'soluk'} style={{ margin: '2px 0 0' }}>
                    {n.kurumTuru ? `${KURUM_TURU_ETIKET[n.kurumTuru]}: ` : ''}
                    {n.aciklama}
                    {n.kesin ? '' : ' (şirket alanından, olası)'}
                  </p>
                ))}
              </li>
            ))}
          </ul>
        )}
      </section>

      {beyin ? <BeyinBolumu slug={slug} veri={beyin.veri} guncellendi={beyin.guncellendi} adlar={adlar} /> : null}

      {/* düzenleme */}
      <KisiDuzenle kisi={kisi} ayarlar={ayarlar} />

      {/* değişiklik geçmişi */}
      <details className="kart">
        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
          Değişiklik geçmişi ({gecmis.length})
        </summary>
        {gecmis.length === 0 ? (
          <p className="bos-durum">Bu kayıtta henüz değişiklik yapılmamış.</p>
        ) : (
          <div className="tablo-sarmal" style={{ marginTop: 12 }}>
            <table>
              <thead>
                <tr>
                  <th>Alan</th>
                  <th>Eski</th>
                  <th>Yeni</th>
                  <th>Zaman</th>
                </tr>
              </thead>
              <tbody>
                {gecmis.map((d) => (
                  <tr key={d.id}>
                    <td>{ALAN_ETIKET[d.alan] ?? d.alan}</td>
                    <td style={{ whiteSpace: 'normal', maxWidth: 240 }}>
                      {d.eski_deger ?? <span className="soluk">boş</span>}
                    </td>
                    <td style={{ whiteSpace: 'normal', maxWidth: 240 }}>
                      {d.yeni_deger ?? <span className="soluk">boş</span>}
                    </td>
                    <td className="soluk">
                      {new Intl.DateTimeFormat('tr-TR', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                        timeZone: 'Europe/Istanbul',
                      }).format(new Date(d.degisiklik_zamani))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </details>
    </div>
  )
}
