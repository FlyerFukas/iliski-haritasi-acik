'use client'

import { useActionState, useState, useTransition } from 'react'
import { gecmisEkle, gecmisKaldir, type GecmisDurumu } from '@/lib/actions/gecmis'
import { EGITIM_TURLERI, KURUM_TURLERI, KURUM_TURU_ETIKET, type KurumTuru } from '@/lib/ortak-nokta'

export interface GecmisSatiri {
  id: string
  kurumAdi: string
  kurumTuru: KurumTuru
  alan: string | null
  baslangic_yil: number | null
  bitis_yil: number | null
  guncel: boolean
  /** 'LinkedIn' ise kayıt LinkedIn aktarımından geldi. */
  kaynak: string | null
}

/**
 * Kişinin geçmişi: çalıştığı şirketler, okuduğu okul ve bölüm, vakıf,
 * dernek... Ortak noktalar bu kayıtlardan hesaplanır (lib/ortak-nokta.ts).
 */
export default function GecmisBolumu({
  kisiId,
  satirlar,
  kurumlar,
  oneri,
  semaVar,
}: {
  kisiId: string
  satirlar: GecmisSatiri[]
  kurumlar: { ad: string; tur: KurumTuru }[]
  /** Şirket alanından çıkarılmış, henüz geçmişte olmayan kurum. */
  oneri: string | null
  semaVar: boolean
}) {
  const [durum, gonder, bekliyor] = useActionState<GecmisDurumu, FormData>(gecmisEkle, {})
  const [acik, setAcik] = useState(false)
  const [kurum, setKurum] = useState('')
  const [tur, setTur] = useState<KurumTuru>('sirket')
  const [kaldiran, gecis] = useTransition()

  const kurumSec = (ad: string) => {
    setKurum(ad)
    const bilinen = kurumlar.find((k) => k.ad.toLocaleLowerCase('tr') === ad.toLocaleLowerCase('tr'))
    if (bilinen) setTur(bilinen.tur)
  }

  const yillar = (s: GecmisSatiri) => {
    const bas = s.baslangic_yil ?? ''
    const bit = s.guncel ? 'devam' : (s.bitis_yil ?? '')
    return bas || bit ? `${bas}–${bit}` : null
  }

  return (
    <section className="kart yigin">
      <div className="kart-baslik">
        <h2>Geçmiş</h2>
        <span className="aralik" />
        <span className="soluk">iş · okul · vakıf · dernek</span>
      </div>

      {!semaVar ? (
        <p className="hata">
          Geçmiş tabloları henüz kurulmadı. “supabase/migrations/0004_gecmis.sql” dosyasını
          Supabase SQL Editor’de çalıştır.
        </p>
      ) : null}

      {satirlar.length === 0 ? (
        <p className="bos-durum">Henüz geçmiş kaydı yok.</p>
      ) : (
        <ul className="cizelge">
          {satirlar.map((s) => (
            <li key={s.id}>
              <div className="satir">
                <strong>{s.kurumAdi}</strong>
                <span className="rozet rozet-notr">{KURUM_TURU_ETIKET[s.kurumTuru]}</span>
                {s.kaynak ? (
                  <span className="rozet rozet-notr" title="LinkedIn aktarımından geldi" style={{ color: '#0a66c2' }}>
                    {s.kaynak}
                  </span>
                ) : null}
                {yillar(s) ? <span className="soluk">{yillar(s)}</span> : null}
                <span className="aralik" />
                <button
                  type="button"
                  className="btn btn-kucuk"
                  disabled={kaldiran}
                  onClick={() => gecis(() => gecmisKaldir(s.id, kisiId))}
                  title="Kayıt silinmez, arşivlenir"
                >
                  Kaldır
                </button>
              </div>
              {s.alan ? <p style={{ margin: '4px 0 0' }}>{s.alan}</p> : null}
            </li>
          ))}
        </ul>
      )}

      {oneri && semaVar && !acik ? (
        <p className="soluk" style={{ margin: 0 }}>
          Şirket alanında “{oneri}” yazıyor.{' '}
          <button
            type="button"
            className="btn btn-kucuk"
            onClick={() => {
              kurumSec(oneri)
              setAcik(true)
            }}
          >
            Geçmişe ekle
          </button>
        </p>
      ) : null}

      {!acik ? (
        <button type="button" className="btn" onClick={() => setAcik(true)} disabled={!semaVar}>
          + Geçmiş ekle
        </button>
      ) : (
        <form action={gonder} className="yigin">
          <input type="hidden" name="kisi_id" value={kisiId} />
          <div className="izgara">
            <div className="alan">
              <label className="etiket" htmlFor="g-kurum">
                Kurum
              </label>
              <input
                id="g-kurum"
                name="kurum"
                list="g-kurumlar"
                required
                value={kurum}
                onChange={(e) => kurumSec(e.target.value)}
                placeholder="Şirket, üniversite, vakıf..."
              />
              <datalist id="g-kurumlar">
                {kurumlar.map((k) => (
                  <option key={k.ad} value={k.ad} />
                ))}
              </datalist>
            </div>
            <div className="alan">
              <label className="etiket" htmlFor="g-tur">
                Tür
              </label>
              <select id="g-tur" name="tur" value={tur} onChange={(e) => setTur(e.target.value as KurumTuru)}>
                {KURUM_TURLERI.map((t) => (
                  <option key={t} value={t}>
                    {KURUM_TURU_ETIKET[t]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="alan">
            <label className="etiket" htmlFor="g-alan">
              {EGITIM_TURLERI.includes(tur) ? 'Bölüm' : 'Unvan / görev'}
            </label>
            <input
              id="g-alan"
              name="alan"
              placeholder={EGITIM_TURLERI.includes(tur) ? 'Endüstri Mühendisliği' : 'Proje Lideri, Mentor, Üye...'}
            />
          </div>
          <div className="izgara">
            <div className="alan">
              <label className="etiket" htmlFor="g-bas">
                Başlangıç yılı
              </label>
              <input id="g-bas" name="baslangic_yil" type="number" min={1900} max={2100} inputMode="numeric" />
            </div>
            <div className="alan">
              <label className="etiket" htmlFor="g-bit">
                Bitiş yılı
              </label>
              <input id="g-bit" name="bitis_yil" type="number" min={1900} max={2100} inputMode="numeric" />
            </div>
          </div>
          <label className="satir">
            <input type="checkbox" name="guncel" /> Hâlâ devam ediyor
          </label>
          <div className="satir">
            <button type="submit" className="btn btn-birincil" disabled={bekliyor}>
              {bekliyor ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
            <button type="button" className="btn" onClick={() => setAcik(false)}>
              Kapat
            </button>
          </div>
          {durum.hata ? (
            <p className="hata" role="alert">
              {durum.hata}
            </p>
          ) : null}
          {durum.kaydedildi ? <p className="soluk">Kaydedildi.</p> : null}
        </form>
      )}
    </section>
  )
}
