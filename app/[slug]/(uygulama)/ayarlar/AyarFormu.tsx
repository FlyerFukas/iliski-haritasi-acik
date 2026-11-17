'use client'

import { useActionState } from 'react'
import { ayarlariKaydet, type AyarDurumu } from '@/lib/actions/ayarlar'
import { FREKANSLAR, type Ayarlar } from '@/lib/hesaplama'

/** Her frekansın ne anlama geldiğini anlatan kısa açıklama. */
const ACIKLAMA: Record<number, string> = {
  1: 'En sık — iç halka, sıcak tutulması gereken bağlar',
  2: 'Sık — düzenli takip',
  3: 'Orta',
  4: 'Seyrek',
  5: 'En seyrek — dış halka, yılda birkaç kez',
}

export default function AyarFormu({ ayarlar }: { ayarlar: Ayarlar }) {
  const [durum, gonder, bekliyor] = useActionState<AyarDurumu, FormData>(ayarlariKaydet, {})

  return (
    <form action={gonder} className="kart yigin">
      <div className="kart-baslik">
        <h2>Temas ritmi</h2>
      </div>
      <p className="soluk" style={{ margin: 0 }}>
        Her kişinin frekansı bu sayılardan birine denk gelir. Değiştirdiğinde tüm
        kişilerin &quot;sonraki temas&quot; tarihi anında yeniden hesaplanır.
      </p>

      {FREKANSLAR.map((f) => {
        const ad = `frekans_${f}_gun` as keyof Ayarlar
        return (
          <div className="alan" key={f}>
            <label className="etiket" htmlFor={ad}>
              Frekans {f} (gün)
            </label>
            <span className="soluk">{ACIKLAMA[f]}</span>
            <input
              id={ad}
              name={ad}
              type="number"
              min={1}
              max={3650}
              required
              defaultValue={ayarlar[ad] as number}
            />
          </div>
        )
      })}

      {durum.hata ? (
        <p className="hata" role="alert">
          {durum.hata}
        </p>
      ) : null}
      {durum.kaydedildi && !durum.hata ? (
        <p className="rozet rozet-GUNCEL" role="status" style={{ padding: '10px 14px' }}>
          ✓ Kaydedildi
        </p>
      ) : null}

      <button type="submit" className="btn btn-birincil btn-genis" disabled={bekliyor}>
        {bekliyor ? 'Kaydediliyor…' : 'Kaydet'}
      </button>
    </form>
  )
}
