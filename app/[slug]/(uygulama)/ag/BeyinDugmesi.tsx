'use client'

import { useState, useTransition } from 'react'
import { beyniGuncelle, type BeyinGuncellemeSonucu } from '@/lib/actions/beyin'

/** Ağ sayfası: öğrenme motorunu şimdi güncelle (yeni temasları öğren, önerileri yenile). */
export default function BeyinDugmesi({ sonGuncelleme }: { sonGuncelleme: string | null }) {
  const [sonuc, setSonuc] = useState<BeyinGuncellemeSonucu | null>(null)
  const [bekliyor, gecis] = useTransition()

  return (
    <div className="satir" style={{ flexWrap: 'wrap', gap: 8 }}>
      <button
        type="button"
        className="btn btn-kucuk"
        disabled={bekliyor}
        onClick={() => gecis(async () => setSonuc(await beyniGuncelle()))}
        title="Yeni temasları beyne öğret, önerileri yenile"
      >
        {bekliyor ? '🧠 Öğreniyor…' : '🧠 Beyni güncelle'}
      </button>
      <span className="soluk" style={{ fontSize: '0.8rem' }}>
        {sonuc?.hata ? (
          <span className="hata">{sonuc.hata}</span>
        ) : sonuc ? (
          `✓ ${sonuc.yeni_kayit} yeni kayıt öğrenildi · toplam ${sonuc.toplam_kayit} kayıt, ${sonuc.noron} nöron`
        ) : sonGuncelleme ? (
          `Son öğrenme: ${new Intl.DateTimeFormat('tr-TR', {
            dateStyle: 'short',
            timeStyle: 'short',
            timeZone: 'Europe/Istanbul',
          }).format(new Date(sonGuncelleme))} · her gün kendiliğinden de öğrenir`
        ) : (
          'Beyin henüz öğrenmedi.'
        )}
      </span>
    </div>
  )
}
