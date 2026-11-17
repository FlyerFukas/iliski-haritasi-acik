'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import { DURUM_ETIKET } from '@/lib/hesaplama'
import { DURUM_SECENEKLERI } from '@/lib/suzme'

/**
 * Çağrı listesi filtreleri — kullanım senaryosu: "İstanbul'a indim, kimleri
 * arayayım?" Bu yüzden şehir en üstte ve tek dokunuşla seçilir.
 */
export default function CagriSuzgec({
  sehirler,
  sektorler,
  sonucSayisi,
  telefonluSayisi,
}: {
  sehirler: string[]
  sektorler: string[]
  sonucSayisi: number
  telefonluSayisi: number
}) {
  const router = useRouter()
  const yol = usePathname()
  const params = useSearchParams()
  const [bekleyen, gecis] = useTransition()

  const secili = (ad: string, deger: string) =>
    (params.get(ad) ?? '').split(',').filter(Boolean).includes(deger)

  const degistir = (ad: string, deger: string) => {
    const mevcut = (params.get(ad) ?? '').split(',').filter(Boolean)
    const yeniler = mevcut.includes(deger)
      ? mevcut.filter((d) => d !== deger)
      : [...mevcut, deger]

    const yeni = new URLSearchParams(params.toString())
    if (yeniler.length) yeni.set(ad, yeniler.join(','))
    else yeni.delete(ad)
    gecis(() => router.replace(`${yol}?${yeni}`, { scroll: false }))
  }

  const anahtarCevir = (ad: string) => {
    const yeni = new URLSearchParams(params.toString())
    if (params.get(ad) === '1') yeni.delete(ad)
    else yeni.set(ad, '1')
    gecis(() => router.replace(`${yol}?${yeni}`, { scroll: false }))
  }

  const grup = (baslik: string, ad: string, degerler: string[]) =>
    degerler.length ? (
      <div className="alan">
        <span className="etiket">{baslik}</span>
        <div className="satir" style={{ gap: 6 }}>
          {degerler.map((d) => (
            <button
              key={d}
              type="button"
              className="btn btn-kucuk"
              aria-pressed={secili(ad, d)}
              onClick={() => degistir(ad, d)}
            >
              {d}
            </button>
          ))}
        </div>
      </div>
    ) : null

  return (
    <div className="kart yigin" style={{ opacity: bekleyen ? 0.6 : 1 }}>
      {grup('Şehir', 'sehir', sehirler)}
      {grup('Sektör', 'sektor', sektorler)}
      <div className="alan">
        <span className="etiket">Durum</span>
        <div className="satir" style={{ gap: 6 }}>
          {DURUM_SECENEKLERI.map((d) => (
            <button
              key={d}
              type="button"
              className="btn btn-kucuk"
              aria-pressed={secili('durum', d)}
              onClick={() => degistir('durum', d)}
            >
              {DURUM_ETIKET[d].replace('⚠ ', '')}
            </button>
          ))}
        </div>
      </div>

      <div className="satir">
        <button
          type="button"
          className="btn btn-kucuk"
          aria-pressed={params.get('telefonlu') === '1'}
          onClick={() => anahtarCevir('telefonlu')}
        >
          Sadece telefonu olanlar ({telefonluSayisi})
        </button>
        <span className="aralik" />
        <span className="soluk">{sonucSayisi} kişi</span>
      </div>
    </div>
  )
}
