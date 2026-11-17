'use client'

import { useActionState, useEffect, useMemo, useRef, useState } from 'react'
import { temasEkle, type TemasDurumu } from '@/lib/actions/temas'
import { YONTEMLER, gunEkle, tarihGoster } from '@/lib/hesaplama'
import { anahtar } from '@/lib/turkce'
import type { KisiSecenek } from '@/lib/sorgular'

/**
 * Temas ekleme formu — hedef: 3 dokunuşta kayıt (SPEC §5.4).
 *
 *   1. kişi   2. yöntem   3. Kaydet
 *
 * Tarih varsayılan olarak bugün; not ve "ofis dışı" isteğe bağlı. Hiçbir alan
 * ek onay ekranı açmaz.
 */

const GORUNEN_KISI = 8

export default function TemasFormu({
  kisiler,
  bugun,
  secili,
}: {
  kisiler: KisiSecenek[]
  bugun: string
  secili?: KisiSecenek
}) {
  const [durum, gonder, bekliyor] = useActionState<TemasDurumu, FormData>(temasEkle, {})

  const [kisi, setKisi] = useState<KisiSecenek | null>(secili ?? null)
  const [arama, setArama] = useState('')
  const [tarih, setTarih] = useState(bugun)
  const [yontem, setYontem] = useState<string>('')
  const [sonEklenen, setSonEklenen] = useState<string | null>(null)

  const aramaKutusu = useRef<HTMLInputElement>(null)

  // Kayıt başarılıysa formu sıfırla, sıradaki girişe hazır ol
  useEffect(() => {
    if (!durum.eklendi) return
    setSonEklenen(durum.eklendi)
    setKisi(null)
    setArama('')
    setTarih(bugun)
    setYontem('')
    aramaKutusu.current?.focus()
  }, [durum, bugun])

  const suzulmus = useMemo(() => {
    const a = anahtar(arama)
    const liste = a
      ? kisiler.filter((k) => anahtar(k.ad).includes(a) || anahtar(k.sirket).includes(a))
      : kisiler
    return liste.slice(0, arama ? 20 : GORUNEN_KISI)
  }, [arama, kisiler])

  const hazir = Boolean(kisi && yontem)

  return (
    <form action={gonder} className="yigin">
      {/* gizli alanlar — asıl gönderilen veri */}
      <input type="hidden" name="kisi_id" value={kisi?.id ?? ''} />
      <input type="hidden" name="tarih" value={tarih} />
      <input type="hidden" name="yontem" value={yontem} />

      {/* ---------------------------------------------------------- 1. kişi */}
      <section className="kart">
        <div className="kart-baslik">
          <h2>1 · Kim?</h2>
          {kisi ? (
            <>
              <span className="aralik" />
              <button
                type="button"
                className="btn btn-kucuk"
                onClick={() => {
                  setKisi(null)
                  setArama('')
                }}
              >
                Değiştir
              </button>
            </>
          ) : null}
        </div>

        {kisi ? (
          <div className="satir">
            <strong style={{ fontSize: '1.05rem' }}>{kisi.ad}</strong>
            {kisi.sirket ? <span className="soluk">· {kisi.sirket}</span> : null}
          </div>
        ) : (
          <div className="yigin" style={{ gap: 10 }}>
            <input
              ref={aramaKutusu}
              type="search"
              inputMode="search"
              placeholder="İsim veya şirket ara…"
              value={arama}
              onChange={(e) => setArama(e.target.value)}
              aria-label="Kişi ara"
            />
            <div className="yigin" style={{ gap: 6 }}>
              {suzulmus.map((k) => (
                <button
                  key={k.id}
                  type="button"
                  className="btn"
                  style={{ justifyContent: 'flex-start', textAlign: 'left' }}
                  onClick={() => setKisi(k)}
                >
                  <span>{k.ad}</span>
                  {k.sirket ? <span className="soluk">· {k.sirket}</span> : null}
                  <span className="aralik" />
                  {k.kalanGun !== null && k.kalanGun < 0 ? (
                    <span className="rozet rozet-GECIKTI">{Math.abs(k.kalanGun)} gün</span>
                  ) : null}
                </button>
              ))}
              {suzulmus.length === 0 ? (
                <p className="bos-durum">Eşleşen kişi yok.</p>
              ) : null}
              {!arama && kisiler.length > GORUNEN_KISI ? (
                <p className="soluk" style={{ textAlign: 'center' }}>
                  En acil {GORUNEN_KISI} kişi gösteriliyor — diğerleri için yaz.
                </p>
              ) : null}
            </div>
          </div>
        )}
      </section>

      {/* -------------------------------------------------------- 2. yöntem */}
      <section className="kart">
        <div className="kart-baslik">
          <h2>2 · Nasıl?</h2>
        </div>
        <div className="satir" style={{ gap: 8 }}>
          {YONTEMLER.map((y) => (
            <button
              key={y}
              type="button"
              className="btn secenek"
              aria-pressed={yontem === y}
              onClick={() => setYontem(y)}
            >
              {y}
            </button>
          ))}
        </div>

        {yontem === 'Yüz yüze' ? (
          <label className="satir" style={{ marginTop: 12, cursor: 'pointer' }}>
            <input
              type="checkbox"
              name="ofis_disi_yuz_yuze"
              style={{ width: 20, height: 20 }}
            />
            <span>
              <strong>Ofis dışında</strong>{' '}
              <span className="soluk">— arkadaşlığa giden yolda sayılır</span>
            </span>
          </label>
        ) : null}
      </section>

      {/* -------------------------------------------- 3. tarih + not (ops.) */}
      <section className="kart">
        <div className="kart-baslik">
          <h2>3 · Ne zaman?</h2>
          <span className="aralik" />
          <span className="soluk">{tarihGoster(tarih)}</span>
        </div>

        <div className="satir" style={{ gap: 8 }}>
          {[
            { etiket: 'Bugün', deger: bugun },
            { etiket: 'Dün', deger: gunEkle(bugun, -1) },
            { etiket: 'Önceki gün', deger: gunEkle(bugun, -2) },
          ].map((s) => (
            <button
              key={s.deger}
              type="button"
              className="btn btn-kucuk"
              aria-pressed={tarih === s.deger}
              onClick={() => setTarih(s.deger)}
            >
              {s.etiket}
            </button>
          ))}
          <input
            type="date"
            value={tarih}
            max={bugun}
            onChange={(e) => e.target.value && setTarih(e.target.value)}
            aria-label="Başka tarih"
            style={{ width: 'auto', flex: '1 1 150px' }}
          />
        </div>

        <div className="alan" style={{ marginTop: 12 }}>
          <label className="etiket" htmlFor="not">
            Not <span style={{ fontWeight: 400 }}>(isteğe bağlı)</span>
          </label>
          <textarea id="not" name="not" placeholder="Ne konuşuldu, ne söz verildi…" />
        </div>
      </section>

      {durum.hata ? (
        <p className="hata" role="alert">
          {durum.hata}
        </p>
      ) : null}

      {sonEklenen && !durum.hata ? (
        <p
          className="rozet rozet-GUNCEL"
          role="status"
          style={{ padding: '10px 14px', fontSize: '0.9rem' }}
        >
          ✓ {sonEklenen} için temas kaydedildi
        </p>
      ) : null}

      <button
        type="submit"
        className="btn btn-birincil btn-genis"
        disabled={!hazir || bekliyor}
        style={{ minHeight: 54, fontSize: '1.05rem' }}
      >
        {bekliyor ? 'Kaydediliyor…' : hazir ? 'Kaydet' : 'Kişi ve yöntem seç'}
      </button>
    </form>
  )
}
