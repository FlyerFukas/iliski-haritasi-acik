'use client'

import Link from 'next/link'
import { useRef, useState, useTransition } from 'react'
import { pdfIleKisiEkle, pdfOnizle, pdfUygula, type PdfOnizleme } from '@/lib/actions/linkedin'
import type { YazimSonucu } from '@/lib/aktarim-yaz'
import { ALAN_ETIKET } from '@/lib/etiketler'
import { KURUM_TURLERI, KURUM_TURU_ETIKET, type KurumTuru } from '@/lib/ortak-nokta'
import { istemciHataMetni } from '@/lib/istemci-hata'

/**
 * K-02: LinkedIn profil PDF'inden doldur / kişi ekle.
 *
 * - `kisiId` verilirse: o kişiye yazar (kişi sayfası).
 * - Verilmezse: PDF'teki LinkedIn adresi ya da adla kayıtlı kişiyi bulur;
 *   bulamazsa yeni kişi açmayı önerir ("in Aktar" ve "Yeni kişi" sayfaları).
 *
 * Her durumda önce önizleme; dolu alanlar sen seçmedikçe değişmez.
 */
export default function LinkedinPdf({
  slug,
  kisiId,
  acik = false,
  baslik = 'LinkedIn PDF’inden doldur',
}: {
  slug: string
  kisiId?: string
  acik?: boolean
  baslik?: string
}) {
  const [onizleme, setOnizleme] = useState<PdfOnizleme | null>(null)
  const [alanSecim, setAlanSecim] = useState<Record<number, boolean>>({})
  const [gecmisSecim, setGecmisSecim] = useState<Record<number, boolean>>({})
  const [turler, setTurler] = useState<Record<number, KurumTuru>>({})
  const [yeniAd, setYeniAd] = useState('')
  const [sonuc, setSonuc] = useState<(YazimSonucu & { kisiId?: string; yeniKisi?: boolean }) | null>(null)
  const [hata, setHata] = useState<string | null>(null)
  const [bekliyor, gecis] = useTransition()
  const dosyaGirdisi = useRef<HTMLInputElement>(null)

  const oku = (dosya: File | undefined) => {
    if (!dosya) return
    setSonuc(null)
    setHata(null)
    const fd = new FormData()
    if (kisiId) fd.set('kisi_id', kisiId)
    fd.set('pdf', dosya)
    gecis(async () => {
      const o = await pdfOnizle(fd)
      if (o.hata) {
        setHata(o.hata)
        setOnizleme(null)
        return
      }
      setOnizleme(o)
      setYeniAd(o.pdfAd ?? '')
      setAlanSecim(Object.fromEntries((o.oneri?.alanlar ?? []).map((a, i) => [i, !a.cakisma])))
      setGecmisSecim(Object.fromEntries((o.oneri?.gecmis ?? []).map((g, i) => [i, !g.zatenVar])))
      setTurler(Object.fromEntries((o.oneri?.gecmis ?? []).map((g, i) => [i, g.tur])))
    })
  }

  const hedefKisi = kisiId ?? onizleme?.eslesen?.kisiId ?? null
  const yeniKisi = !kisiId && onizleme !== null && !onizleme.eslesen

  const uygula = () => {
    const oneri = onizleme?.oneri
    if (!oneri) return
    const alanlar = oneri.alanlar
      .filter((_, i) => alanSecim[i])
      .map((a) => ({ alan: a.alan, yeni: a.yeni, ez: a.cakisma }))
    const gecmis = oneri.gecmis
      .map((g, i) => ({ g, i }))
      .filter(({ g, i }) => gecmisSecim[i] && !g.zatenVar)
      .map(({ g, i }) => ({
        kurum: g.kurum,
        tur: turler[i] ?? g.tur,
        alan: g.alan,
        basYil: g.basYil,
        bitYil: g.bitYil,
        guncel: g.guncel,
      }))
    gecis(async () => {
      try {
        if (yeniKisi) {
          const s = await pdfIleKisiEkle(yeniAd, alanlar, gecmis)
          if (s.hata) {
            setHata(s.hata)
            return
          }
          setSonuc({ ...s, yeniKisi: true })
        } else if (hedefKisi) {
          setSonuc({ ...(await pdfUygula(hedefKisi, alanlar, gecmis)), kisiId: hedefKisi })
        }
        setOnizleme(null)
        if (dosyaGirdisi.current) dosyaGirdisi.current.value = ''
      } catch (e) {
        setHata(istemciHataMetni(e))
      }
    })
  }

  const oneri = onizleme?.oneri
  const seciliSayi =
    Object.values(alanSecim).filter(Boolean).length +
    (oneri?.gecmis.filter((g, i) => gecmisSecim[i] && !g.zatenVar).length ?? 0)

  return (
    <details className="kart" open={acik || undefined}>
      <summary style={{ cursor: 'pointer', fontWeight: 600 }}>{baslik}</summary>
      <div className="yigin" style={{ marginTop: 12 }}>
        <p className="soluk" style={{ margin: 0 }}>
          LinkedIn’de kişinin profilini aç → <strong>Diğer</strong> (…) → <strong>PDF olarak kaydet</strong>.
          İnen dosyayı buraya seç. Önce ne yazılacağını görürsün; dolu alanlar sen seçmedikçe değişmez.
        </p>
        <input
          ref={dosyaGirdisi}
          type="file"
          accept="application/pdf,.pdf"
          disabled={bekliyor}
          onChange={(e) => oku(e.target.files?.[0])}
          aria-label="LinkedIn profil PDF dosyası"
        />
        {bekliyor ? <p className="soluk">İşleniyor…</p> : null}
        {hata ? (
          <p className="hata" role="alert">
            {hata}
          </p>
        ) : null}

        {onizleme && oneri ? (
          <div className="yigin">
            {onizleme.adUyumsuz ? (
              <p className="hata">
                Dikkat: PDF “{onizleme.pdfAd}” adına ait, bu kişinin adıyla uyuşmuyor. Doğru PDF mi?
              </p>
            ) : (
              <p className="soluk" style={{ margin: 0 }}>
                PDF: <strong>{onizleme.pdfAd}</strong>
                {onizleme.baslik ? ` · ${onizleme.baslik}` : ''}
              </p>
            )}

            {!kisiId && onizleme.eslesen ? (
              <p style={{ margin: 0 }}>
                Kayıtlı kişiyle eşleşti:{' '}
                <Link href={`/${slug}/kisiler/${onizleme.eslesen.kisiId}`}>
                  <strong>{onizleme.eslesen.kisiAd}</strong>
                </Link>{' '}
                <span className="soluk">
                  ({onizleme.eslesen.nasil === 'linkedin' ? 'LinkedIn adresiyle' : 'adla'}). Seçtiklerin bu kişiye eklenir.
                </span>
              </p>
            ) : null}

            {yeniKisi ? (
              <div className="alan">
                <label className="etiket" htmlFor="pdf-yeni-ad">
                  Uygulamada yok: yeni kişi olarak eklenecek. Ad
                </label>
                <input id="pdf-yeni-ad" value={yeniAd} onChange={(e) => setYeniAd(e.target.value)} />
              </div>
            ) : null}

            {oneri.alanlar.length > 0 ? (
              <div>
                <div className="etiket">Kişi bilgileri</div>
                {oneri.alanlar.map((a, i) => (
                  <label key={a.alan} className="satir" style={{ alignItems: 'flex-start', gap: 8, marginTop: 6 }}>
                    <input
                      type="checkbox"
                      checked={Boolean(alanSecim[i])}
                      onChange={(e) => setAlanSecim({ ...alanSecim, [i]: e.target.checked })}
                    />
                    <span>
                      <strong>{ALAN_ETIKET[a.alan] ?? a.alan}:</strong> {a.yeni}
                      {a.cakisma ? (
                        <span className="hata" style={{ display: 'block', margin: 0 }}>
                          Şu anki değeri ezer: “{a.mevcut}”
                        </span>
                      ) : null}
                    </span>
                  </label>
                ))}
              </div>
            ) : null}

            {oneri.gecmis.length > 0 ? (
              <div>
                <div className="etiket">Geçmiş (iş ve eğitim)</div>
                {oneri.gecmis.map((g, i) => (
                  <div key={i} className="satir" style={{ alignItems: 'flex-start', gap: 8, marginTop: 6 }}>
                    <input
                      type="checkbox"
                      disabled={g.zatenVar}
                      checked={Boolean(gecmisSecim[i]) && !g.zatenVar}
                      onChange={(e) => setGecmisSecim({ ...gecmisSecim, [i]: e.target.checked })}
                      aria-label={`${g.kurum} kaydını ekle`}
                    />
                    <span style={{ flex: 1 }}>
                      <strong>{g.kurum}</strong>
                      {g.alan ? ` · ${g.alan}` : ''}
                      <span className="soluk">
                        {' '}
                        {g.basYil ?? ''}
                        {g.basYil || g.bitYil || g.guncel ? '–' : ''}
                        {g.guncel ? 'devam' : (g.bitYil ?? '')}
                      </span>
                      {g.zatenVar ? <span className="soluk"> (zaten kayıtlı)</span> : null}
                    </span>
                    <select
                      value={turler[i] ?? g.tur}
                      disabled={g.zatenVar}
                      onChange={(e) => setTurler({ ...turler, [i]: e.target.value as KurumTuru })}
                      aria-label="Kurum türü"
                      style={{ width: 'auto' }}
                    >
                      {KURUM_TURLERI.map((t) => (
                        <option key={t} value={t}>
                          {KURUM_TURU_ETIKET[t]}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            ) : null}

            {!yeniKisi && oneri.alanlar.length === 0 && oneri.gecmis.every((g) => g.zatenVar) ? (
              <p className="bos-durum">PDF’teki her şey zaten kayıtlı, eklenecek yeni bilgi yok.</p>
            ) : (
              <div className="satir">
                <button
                  type="button"
                  className="btn btn-birincil"
                  disabled={bekliyor || (yeniKisi ? !yeniAd.trim() : seciliSayi === 0)}
                  onClick={uygula}
                >
                  {yeniKisi ? `Kişiyi ekle (${seciliSayi} bilgiyle)` : `Seçilenleri kaydet (${seciliSayi})`}
                </button>
                <button type="button" className="btn" onClick={() => setOnizleme(null)}>
                  Vazgeç
                </button>
              </div>
            )}
          </div>
        ) : null}

        {sonuc ? (
          <div>
            <p style={{ margin: 0 }}>
              ✓ {sonuc.yeniKisi ? 'Yeni kişi eklendi, ' : ''}
              {sonuc.yazilanAlan} alan, {sonuc.eklenenGecmis} geçmiş kaydı yazıldı.
              {sonuc.atlananGecmis ? ` ${sonuc.atlananGecmis} kayıt zaten vardı.` : ''}{' '}
              {!kisiId && sonuc.kisiId ? <Link href={`/${slug}/kisiler/${sonuc.kisiId}`}>Kişiyi aç →</Link> : null}
            </p>
            {sonuc.uyarilar.map((u, i) => (
              <p key={i} className="hata">
                {u}
              </p>
            ))}
            {!kisiId ? <p className="soluk">Başka bir PDF seçerek devam edebilirsin.</p> : null}
          </div>
        ) : null}
      </div>
    </details>
  )
}
