'use client'

import { useMemo, useState, useTransition } from 'react'
import { csvKarsilastir, csvUygula, type CsvRapor, type CsvUygulamaSonucu } from '@/lib/actions/linkedin'
import { ALAN_ETIKET } from '@/lib/etiketler'
import { istemciHataMetni } from '@/lib/istemci-hata'

const SAYFA = 50

export default function CsvAktar() {
  const [rapor, setRapor] = useState<CsvRapor | null>(null)
  /** `${eslesmeIndeksi}:a${alanIndeksi}` / `${eslesmeIndeksi}:g${gecmisIndeksi}` → seçili mi */
  const [secim, setSecim] = useState<Record<string, boolean>>({})
  const [yeniSecim, setYeniSecim] = useState<Record<number, boolean>>({})
  const [arama, setArama] = useState('')
  const [goster, setGoster] = useState(SAYFA)
  const [sonuc, setSonuc] = useState<CsvUygulamaSonucu | null>(null)
  const [hata, setHata] = useState<string | null>(null)
  const [bekliyor, gecis] = useTransition()

  const oku = async (dosya: File | undefined) => {
    if (!dosya) return
    setHata(null)
    setSonuc(null)
    const metin = await dosya.text()
    gecis(async () => {
      const r = await csvKarsilastir(metin)
      if (r.hata) {
        setHata(r.hata)
        setRapor(null)
        return
      }
      setRapor(r)
      const ilk: Record<string, boolean> = {}
      r.eslesen?.forEach((e, i) => {
        e.oneri.alanlar.forEach((a, j) => (ilk[`${i}:a${j}`] = !a.cakisma))
        e.oneri.gecmis.forEach((g, j) => (ilk[`${i}:g${j}`] = !g.zatenVar))
      })
      setSecim(ilk)
      setYeniSecim({})
    })
  }

  const yeniListe = useMemo(() => {
    const q = arama.trim().toLocaleLowerCase('tr')
    return (rapor?.yeniAday ?? [])
      .map((b, i) => ({ b, i }))
      .filter(({ b }) => !q || [b.ad, b.sirket, b.pozisyon].join(' ').toLocaleLowerCase('tr').includes(q))
  }, [rapor, arama])

  const uygula = () => {
    if (!rapor) return
    const guncellemeler = (rapor.eslesen ?? []).map((e, i) => ({
      kisiId: e.kisiId,
      alanlar: e.oneri.alanlar
        .filter((_, j) => secim[`${i}:a${j}`])
        .map((a) => ({ alan: a.alan, yeni: a.yeni, ez: a.cakisma })),
      gecmis: e.oneri.gecmis
        .filter((g, j) => secim[`${i}:g${j}`] && !g.zatenVar)
        .map((g) => ({ kurum: g.kurum, tur: g.tur, alan: g.alan, basYil: g.basYil, bitYil: g.bitYil, guncel: g.guncel })),
    }))
    const yeniler = (rapor.yeniAday ?? []).filter((_, i) => yeniSecim[i])
    gecis(async () => {
      try {
        setSonuc(await csvUygula(guncellemeler.filter((g) => g.alanlar.length || g.gecmis.length), yeniler))
        setRapor(null)
      } catch (e) {
        setHata(istemciHataMetni(e))
      }
    })
  }

  const seciliSayi = Object.values(secim).filter(Boolean).length + Object.values(yeniSecim).filter(Boolean).length
  const tumunu = (deger: boolean) => {
    const yeni: Record<string, boolean> = {}
    rapor?.eslesen?.forEach((e, i) => {
      e.oneri.alanlar.forEach((a, j) => (yeni[`${i}:a${j}`] = deger && !a.cakisma))
      e.oneri.gecmis.forEach((g, j) => (yeni[`${i}:g${j}`] = deger && !g.zatenVar))
    })
    setSecim(yeni)
  }

  return (
    <div className="yigin">
      <div className="kart yigin">
        <label className="etiket" htmlFor="csv">
          Connections.csv
        </label>
        <input id="csv" type="file" accept=".csv,text/csv" disabled={bekliyor} onChange={(e) => oku(e.target.files?.[0])} />
        {bekliyor ? <p className="soluk">İşleniyor…</p> : null}
        {hata ? (
          <p className="hata" role="alert">
            {hata}
          </p>
        ) : null}
      </div>

      {rapor ? (
        <>
          <div className="kart">
            <p style={{ margin: 0 }}>
              <strong>{rapor.toplam}</strong> bağlantı okundu · <strong>{rapor.eslesen?.length}</strong> kayıtlı
              kişiyle eşleşti ve eklenecek bilgi var · {rapor.degisiklikYok} eşleşti ama yeni bilgi yok ·{' '}
              <strong>{rapor.yeniAday?.length}</strong> kişi uygulamada yok
            </p>
          </div>

          {rapor.eslesen?.length ? (
            <section className="kart yigin">
              <div className="kart-baslik">
                <h2>Kayıtlı kişilerine eklenecekler</h2>
                <span className="aralik" />
                <button type="button" className="btn btn-kucuk" onClick={() => tumunu(true)}>
                  Hepsi
                </button>
                <button type="button" className="btn btn-kucuk" onClick={() => tumunu(false)}>
                  Hiçbiri
                </button>
              </div>
              {rapor.eslesen.map((e, i) => (
                <div key={e.kisiId} style={{ borderTop: '1px solid var(--kenar)', paddingTop: 8 }}>
                  <div className="satir">
                    <strong>{e.kisiAd}</strong>
                    {e.arsivde ? <span className="rozet rozet-notr">arşiv</span> : null}
                    <span className="aralik" />
                    <span className="soluk">
                      {e.nasil === 'linkedin' ? 'LinkedIn adresiyle eşleşti' : `adla eşleşti (${e.baglanti.ad})`}
                    </span>
                  </div>
                  {e.oneri.alanlar.map((a, j) => (
                    <label key={a.alan} className="satir" style={{ gap: 8, alignItems: 'flex-start' }}>
                      <input
                        type="checkbox"
                        checked={Boolean(secim[`${i}:a${j}`])}
                        onChange={(ev) => setSecim({ ...secim, [`${i}:a${j}`]: ev.target.checked })}
                      />
                      <span>
                        {ALAN_ETIKET[a.alan] ?? a.alan}: {a.yeni}
                        {a.cakisma ? <span className="hata" style={{ display: 'block', margin: 0 }}>Şu anki değeri ezer: “{a.mevcut}”</span> : null}
                      </span>
                    </label>
                  ))}
                  {e.oneri.gecmis.map((g, j) =>
                    g.zatenVar ? null : (
                      <label key={j} className="satir" style={{ gap: 8 }}>
                        <input
                          type="checkbox"
                          checked={Boolean(secim[`${i}:g${j}`])}
                          onChange={(ev) => setSecim({ ...secim, [`${i}:g${j}`]: ev.target.checked })}
                        />
                        <span>
                          Geçmişe ekle: {g.kurum}
                          {g.alan ? ` · ${g.alan}` : ''} <span className="soluk">(şu an)</span>
                        </span>
                      </label>
                    ),
                  )}
                </div>
              ))}
            </section>
          ) : null}

          {rapor.yeniAday?.length ? (
            <section className="kart yigin">
              <div className="kart-baslik">
                <h2>Uygulamada olmayanlar</h2>
                <span className="aralik" />
                <span className="soluk">yalnız seçtiklerin eklenir</span>
              </div>
              <input value={arama} onChange={(e) => setArama(e.target.value)} placeholder="Ad, şirket ya da pozisyonla süz…" aria-label="Yeni adaylarda ara" />
              {yeniListe.slice(0, goster).map(({ b, i }) => (
                <label key={i} className="satir" style={{ gap: 8, alignItems: 'flex-start' }}>
                  <input
                    type="checkbox"
                    checked={Boolean(yeniSecim[i])}
                    onChange={(ev) => setYeniSecim({ ...yeniSecim, [i]: ev.target.checked })}
                  />
                  <span>
                    <strong>{b.ad}</strong>
                    <span className="soluk"> {[b.pozisyon, b.sirket].filter(Boolean).join(' · ')}</span>
                  </span>
                </label>
              ))}
              {yeniListe.length > goster ? (
                <button type="button" className="btn btn-kucuk" onClick={() => setGoster(goster + SAYFA)}>
                  Daha fazla göster ({yeniListe.length - goster} kaldı)
                </button>
              ) : null}
            </section>
          ) : null}

          <div className="satir">
            <button type="button" className="btn btn-birincil" disabled={bekliyor || seciliSayi === 0} onClick={uygula}>
              Seçilenleri kaydet ({seciliSayi})
            </button>
            <button type="button" className="btn" onClick={() => setRapor(null)}>
              Vazgeç
            </button>
          </div>
        </>
      ) : null}

      {sonuc ? (
        <div className="kart">
          <p style={{ margin: 0 }}>
            ✓ {sonuc.yazilanAlan} alan güncellendi · {sonuc.eklenenGecmis} geçmiş kaydı · {sonuc.eklenenKisi} yeni kişi
            {sonuc.atlananAlan ? ` · ${sonuc.atlananAlan} dolu alan korundu` : ''}
          </p>
          {sonuc.uyarilar.map((u, i) => (
            <p key={i} className="hata">
              {u}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  )
}
