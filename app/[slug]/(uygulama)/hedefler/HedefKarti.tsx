'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { hedefDurumDegistir, hedefiKisiyeTasi } from '@/lib/actions/hedef'
import { HEDEF_DURUMLARI } from '@/lib/hesaplama'
import { istemciHataMetni } from '@/lib/istemci-hata'

export interface Hedef {
  id: string
  hedef_isim: string
  sirket_rol: string | null
  neden: string | null
  ortak_baglanti: string | null
  yaklasim_plani: string | null
  durum: string
  not: string | null
  tasindi_kisi_id: string | null
}

export default function HedefKarti({ hedef, slug }: { hedef: Hedef; slug: string }) {
  const router = useRouter()
  const [bekleyen, gecis] = useTransition()
  const [hata, setHata] = useState<string | null>(null)

  const calistir = (is: () => Promise<unknown>) =>
    gecis(async () => {
      setHata(null)
      try {
        await is()
      } catch (e) {
        setHata(istemciHataMetni(e))
      }
    })

  return (
    <div className="kart" style={{ opacity: bekleyen ? 0.6 : 1 }}>
      <div className="satir">
        <strong>{hedef.hedef_isim}</strong>
        {hedef.sirket_rol ? <span className="soluk">· {hedef.sirket_rol}</span> : null}
        <span className="aralik" />
        {hedef.tasindi_kisi_id ? (
          <a href={`/${slug}/kisiler/${hedef.tasindi_kisi_id}`} className="btn btn-kucuk">
            Kişi kaydına git →
          </a>
        ) : null}
      </div>

      {hedef.neden ? <p style={{ margin: '8px 0 0' }}>{hedef.neden}</p> : null}

      <div className="izgara" style={{ marginTop: 10 }}>
        {hedef.ortak_baglanti ? (
          <div>
            <div className="etiket">Ortak bağlantı</div>
            <div>{hedef.ortak_baglanti}</div>
          </div>
        ) : null}
        {hedef.yaklasim_plani ? (
          <div>
            <div className="etiket">Yaklaşım planı</div>
            <div>{hedef.yaklasim_plani}</div>
          </div>
        ) : null}
      </div>

      {hedef.not ? (
        <p className="soluk" style={{ margin: '8px 0 0' }}>
          {hedef.not}
        </p>
      ) : null}

      <div className="alan" style={{ marginTop: 12 }}>
        <span className="etiket">Durum</span>
        <div className="satir" style={{ gap: 6 }}>
          {HEDEF_DURUMLARI.map((d) => (
            <button
              key={d}
              type="button"
              className="btn btn-kucuk"
              aria-pressed={hedef.durum === d}
              disabled={bekleyen || Boolean(hedef.tasindi_kisi_id)}
              onClick={() => calistir(() => hedefDurumDegistir(hedef.id, d))}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {hedef.durum === 'Tanıştım' && !hedef.tasindi_kisi_id ? (
        <button
          type="button"
          className="btn btn-birincil btn-genis"
          style={{ marginTop: 12 }}
          disabled={bekleyen}
          onClick={() =>
            calistir(async () => {
              const kisiId = await hedefiKisiyeTasi(hedef.id)
              router.push(`/${slug}/kisiler/${kisiId}`)
            })
          }
        >
          Kişilere taşı →
        </button>
      ) : null}

      {hata ? (
        <p className="hata" role="alert" style={{ marginTop: 10 }}>
          {hata}
        </p>
      ) : null}
    </div>
  )
}
