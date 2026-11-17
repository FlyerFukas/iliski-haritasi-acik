'use client'

import { useActionState } from 'react'
import { girisYap, type GirisDurumu } from '@/lib/actions/oturum'

export default function GirisFormu() {
  const [durum, gonder, bekliyor] = useActionState<GirisDurumu, FormData>(girisYap, {})

  return (
    <form action={gonder} className="kart yigin">
      <div className="alan">
        <label className="etiket" htmlFor="parola">
          Parola
        </label>
        <input
          id="parola"
          name="parola"
          type="password"
          autoComplete="current-password"
          autoFocus
          required
        />
      </div>

      {durum.hata ? (
        <p className="hata" role="alert">
          {durum.hata}
        </p>
      ) : null}

      <button type="submit" className="btn btn-birincil btn-genis" disabled={bekliyor}>
        {bekliyor ? 'Kontrol ediliyor…' : 'Gir'}
      </button>
    </form>
  )
}
