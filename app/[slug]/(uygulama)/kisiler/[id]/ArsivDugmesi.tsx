'use client'

import { useState, useTransition } from 'react'
import { arsivDegistir } from '@/lib/actions/kisi'
import { istemciHataMetni } from '@/lib/istemci-hata'

/**
 * Arşivle / arşivden çıkar. Silme yok — kişi kaydı hiçbir zaman yok edilmez
 * (CLAUDE.md kural 1). Arşive alma geri alınabilir olduğu için onay sormuyoruz.
 */
export default function ArsivDugmesi({ id, arsivde }: { id: string; arsivde: boolean }) {
  const [bekleyen, gecis] = useTransition()
  const [hata, setHata] = useState<string | null>(null)

  return (
    <>
      <button
        type="button"
        className="btn btn-kucuk"
        disabled={bekleyen}
        onClick={() =>
          gecis(async () => {
            setHata(null)
            try {
              await arsivDegistir(id, !arsivde)
            } catch (e) {
              setHata(istemciHataMetni(e))
            }
          })
        }
      >
        {bekleyen ? '…' : arsivde ? 'Arşivden çıkar' : 'Arşivle'}
      </button>
      {hata ? (
        <p className="hata" role="alert">
          {hata}
        </p>
      ) : null}
    </>
  )
}
