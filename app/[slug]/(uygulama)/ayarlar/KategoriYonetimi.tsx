'use client'

import { useActionState, useEffect, useRef, useState, useTransition } from 'react'
import {
  kategoriEkle,
  kategoriSil,
  type KategoriDurumu,
} from '@/lib/actions/ayarlar'
import { istemciHataMetni } from '@/lib/istemci-hata'

/**
 * Kategori ekle / çıkar.
 *
 * Kategoriler artık kodda sabit değil; buradan düzenlenir. Bir kategoriyi
 * listeden çıkarmak kişilerin verisini SİLMEZ — sadece yeni seçimlerde
 * görünmez olur (CLAUDE.md kural 1).
 */
export default function KategoriYonetimi({
  kategoriler,
  kullanim,
}: {
  kategoriler: string[]
  /** kategori adı → o kategorideki kişi sayısı */
  kullanim: Record<string, number>
}) {
  const [durum, gonder, ekleniyor] = useActionState<KategoriDurumu, FormData>(
    kategoriEkle,
    {},
  )
  const [bekleyen, gecis] = useTransition()
  const [hata, setHata] = useState<string | null>(null)
  const [onay, setOnay] = useState<{ ad: string; mesaj: string } | null>(null)
  const form = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (durum.eklendi) form.current?.reset()
  }, [durum])

  const sil = (ad: string, zorla: boolean) =>
    gecis(async () => {
      setHata(null)
      try {
        const sonuc = await kategoriSil(ad, zorla)
        if (sonuc.uyari) setOnay({ ad, mesaj: sonuc.uyari })
        else setOnay(null)
      } catch (e) {
        setHata(istemciHataMetni(e))
      }
    })

  return (
    <section className="kart yigin">
      <div className="kart-baslik">
        <h2>Kategoriler</h2>
        <span className="aralik" />
        <span className="soluk">{kategoriler.length} tane</span>
      </div>
      <p className="soluk" style={{ margin: 0 }}>
        Kişileri gruplamak için kullandığın etiketler. Buraya eklediğin her kategori
        kişi formlarında ve filtrelerde çıkar.
      </p>

      <ul className="yigin" style={{ listStyle: 'none', margin: 0, padding: 0, gap: 8 }}>
        {kategoriler.map((k) => (
          <li key={k} className="satir" style={{ gap: 8 }}>
            <span>{k}</span>
            <span className="soluk">
              {kullanim[k] ? `${kullanim[k]} kişi` : 'kullanılmıyor'}
            </span>
            <span className="aralik" />
            <button
              type="button"
              className="btn btn-kucuk"
              disabled={bekleyen}
              onClick={() => sil(k, false)}
            >
              Çıkar
            </button>
          </li>
        ))}
        {kategoriler.length === 0 ? (
          <li className="soluk">Hiç kategori yok — aşağıdan ekle.</li>
        ) : null}
      </ul>

      {onay ? (
        <div className="hata yigin" role="alert" style={{ gap: 10 }}>
          <span>{onay.mesaj}</span>
          <div className="satir">
            <button
              type="button"
              className="btn btn-kucuk"
              disabled={bekleyen}
              onClick={() => sil(onay.ad, true)}
            >
              Evet, çıkar
            </button>
            <button
              type="button"
              className="btn btn-kucuk"
              onClick={() => setOnay(null)}
            >
              Vazgeç
            </button>
          </div>
        </div>
      ) : null}

      {hata ? (
        <p className="hata" role="alert">
          {hata}
        </p>
      ) : null}

      <form ref={form} action={gonder} className="satir" style={{ gap: 8 }}>
        <input
          name="kategori"
          type="text"
          required
          maxLength={60}
          placeholder="Yeni kategori — örn. Yakın arkadaşım"
          style={{ flex: '1 1 200px' }}
          aria-label="Yeni kategori adı"
        />
        <button type="submit" className="btn btn-birincil" disabled={ekleniyor}>
          {ekleniyor ? 'Ekleniyor…' : 'Ekle'}
        </button>
      </form>

      {durum.hata ? (
        <p className="hata" role="alert">
          {durum.hata}
        </p>
      ) : null}
      {durum.eklendi ? (
        <p className="rozet rozet-GUNCEL" role="status" style={{ padding: '8px 12px' }}>
          ✓ &quot;{durum.eklendi}&quot; eklendi
        </p>
      ) : null}
    </section>
  )
}
