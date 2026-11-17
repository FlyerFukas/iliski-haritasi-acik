'use client'

import { useActionState, useEffect, useRef } from 'react'
import { hedefEkle, type HedefDurumu } from '@/lib/actions/hedef'

export default function HedefEkle() {
  const [durum, gonder, bekliyor] = useActionState<HedefDurumu, FormData>(hedefEkle, {})
  const form = useRef<HTMLFormElement>(null)
  const acilir = useRef<HTMLDetailsElement>(null)

  useEffect(() => {
    if (durum.eklendi) {
      form.current?.reset()
      if (acilir.current) acilir.current.open = false
    }
  }, [durum])

  const alan = (ad: string, etiket: string, uzun = false) => (
    <div className="alan">
      <label className="etiket" htmlFor={ad}>
        {etiket}
      </label>
      {uzun ? <textarea id={ad} name={ad} /> : <input id={ad} name={ad} type="text" />}
    </div>
  )

  return (
    <details ref={acilir} className="kart">
      <summary style={{ cursor: 'pointer', fontWeight: 650 }}>+ Yeni hedef ekle</summary>

      <form ref={form} action={gonder} className="yigin" style={{ marginTop: 12 }}>
        <div className="alan">
          <label className="etiket" htmlFor="hedef_isim">
            Hedef isim *
          </label>
          <input id="hedef_isim" name="hedef_isim" type="text" required />
        </div>

        {alan('sirket_rol', 'Şirket / rol')}
        {alan('neden', 'Neden tanışmak istiyorum', true)}
        {alan('ortak_baglanti', 'Ortak bağlantı / kaynak')}
        {alan('yaklasim_plani', 'Yaklaşım planı', true)}
        {alan('not', 'Not', true)}

        {durum.hata ? (
          <p className="hata" role="alert">
            {durum.hata}
          </p>
        ) : null}

        <button type="submit" className="btn btn-birincil btn-genis" disabled={bekliyor}>
          {bekliyor ? 'Ekleniyor…' : 'Ekle'}
        </button>
      </form>
    </details>
  )
}
