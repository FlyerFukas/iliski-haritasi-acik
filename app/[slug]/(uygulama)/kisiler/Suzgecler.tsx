'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'
import { DURUM_ETIKET, FREKANSLAR, HALKALAR } from '@/lib/hesaplama'
import { DURUM_SECENEKLERI, type Siralama } from '@/lib/suzme'

/**
 * Filtre kontrolleri. Durum adres çubuğunda tutulur; bu bileşen yalnızca
 * URL'i günceller, süzme işini sunucu yapar (lib/suzme.ts).
 */

const SIRALAMA_ETIKET: Record<Siralama, string> = {
  sonraki: 'Sonraki temas',
  ad: 'Ad',
  'son-temas': 'Son temas',
}

export default function Suzgecler({
  sektorler,
  sehirler,
  kategoriler,
  etkinSayi,
  sonucSayisi,
}: {
  sektorler: string[]
  sehirler: string[]
  kategoriler: string[]
  etkinSayi: number
  sonucSayisi: number
}) {
  const router = useRouter()
  const yol = usePathname()
  const params = useSearchParams()
  const [bekleyen, gecis] = useTransition()

  const [arama, setArama] = useState(params.get('q') ?? '')
  const ilkCizim = useRef(true)

  // arama kutusu: yazmayı bırakınca URL'e yaz
  useEffect(() => {
    if (ilkCizim.current) {
      ilkCizim.current = false
      return
    }
    const zamanlayici = setTimeout(() => {
      const yeni = new URLSearchParams(params.toString())
      if (arama.trim()) yeni.set('q', arama.trim())
      else yeni.delete('q')
      gecis(() => router.replace(`${yol}?${yeni}`, { scroll: false }))
    }, 300)
    return () => clearTimeout(zamanlayici)
    // params'ı bilerek dışarıda tutuyoruz: her URL değişiminde tekrar tetiklenmesin
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arama])

  const secili = (ad: string, deger: string) =>
    (params.get(ad) ?? '').split(',').filter(Boolean).includes(deger)

  const degistir = (ad: string, deger: string) => {
    const mevcut = (params.get(ad) ?? '').split(',').filter(Boolean)
    const yeniDegerler = mevcut.includes(deger)
      ? mevcut.filter((d) => d !== deger)
      : [...mevcut, deger]

    const yeni = new URLSearchParams(params.toString())
    if (yeniDegerler.length) yeni.set(ad, yeniDegerler.join(','))
    else yeni.delete(ad)
    gecis(() => router.replace(`${yol}?${yeni}`, { scroll: false }))
  }

  const tekli = (ad: string, deger: string) => {
    const yeni = new URLSearchParams(params.toString())
    if (deger) yeni.set(ad, deger)
    else yeni.delete(ad)
    gecis(() => router.replace(`${yol}?${yeni}`, { scroll: false }))
  }

  const temizle = () => {
    setArama('')
    ilkCizim.current = true
    gecis(() => router.replace(yol, { scroll: false }))
  }

  const grup = (baslik: string, ad: string, secenekler: Array<{ deger: string; etiket: string }>) =>
    secenekler.length ? (
      <div className="alan">
        <span className="etiket">{baslik}</span>
        <div className="satir" style={{ gap: 6 }}>
          {secenekler.map((s) => (
            <button
              key={s.deger}
              type="button"
              className="btn btn-kucuk"
              aria-pressed={secili(ad, s.deger)}
              onClick={() => degistir(ad, s.deger)}
            >
              {s.etiket}
            </button>
          ))}
        </div>
      </div>
    ) : null

  return (
    <div className="kart yigin" style={{ opacity: bekleyen ? 0.6 : 1 }}>
      <input
        type="search"
        value={arama}
        onChange={(e) => setArama(e.target.value)}
        placeholder="Ad, şirket, kişisel detay içinde ara…"
        aria-label="Kişilerde ara"
      />

      <div className="satir">
        <span className="soluk">{sonucSayisi} kişi</span>
        <span className="aralik" />
        <label className="etiket" htmlFor="sirala">
          Sırala
        </label>
        <select
          id="sirala"
          value={params.get('sirala') ?? 'sonraki'}
          onChange={(e) => tekli('sirala', e.target.value)}
          style={{ width: 'auto' }}
        >
          {(Object.keys(SIRALAMA_ETIKET) as Siralama[]).map((s) => (
            <option key={s} value={s}>
              {SIRALAMA_ETIKET[s]}
            </option>
          ))}
        </select>
      </div>

      <details open={etkinSayi > 0}>
        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
          Filtreler {etkinSayi > 0 ? `(${etkinSayi})` : ''}
        </summary>

        <div className="yigin" style={{ marginTop: 12 }}>
          {grup(
            'Durum',
            'durum',
            DURUM_SECENEKLERI.map((d) => ({
              deger: d,
              etiket: DURUM_ETIKET[d].replace('⚠ ', ''),
            })),
          )}
          {grup('Halka', 'halka', HALKALAR.map((h) => ({ deger: h, etiket: h })))}
          {grup(
            'Kategori',
            'kategori',
            kategoriler.map((k) => ({ deger: k, etiket: k })),
          )}
          {grup(
            'Frekans',
            'frekans',
            FREKANSLAR.map((f) => ({ deger: String(f), etiket: `${f}` })),
          )}
          {grup('Sektör', 'sektor', sektorler.map((s) => ({ deger: s, etiket: s })))}
          {grup('Şehir', 'sehir', sehirler.map((s) => ({ deger: s, etiket: s })))}

          <div className="satir">
            <button
              type="button"
              className="btn btn-kucuk"
              aria-pressed={params.get('arsiv') === '1'}
              onClick={() => tekli('arsiv', params.get('arsiv') === '1' ? '' : '1')}
            >
              Arşivdekiler de görünsün
            </button>
            <button
              type="button"
              className="btn btn-kucuk"
              aria-pressed={params.get('linkedin') === 'yok'}
              onClick={() => tekli('linkedin', params.get('linkedin') === 'yok' ? '' : 'yok')}
            >
              LinkedIn’i olmayanlar
            </button>
            <span className="aralik" />
            {etkinSayi > 0 ? (
              <button type="button" className="btn btn-kucuk" onClick={temizle}>
                Filtreleri temizle
              </button>
            ) : null}
          </div>
        </div>
      </details>
    </div>
  )
}
