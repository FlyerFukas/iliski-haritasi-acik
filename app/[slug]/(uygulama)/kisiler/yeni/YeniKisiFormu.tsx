'use client'

import { useRouter } from 'next/navigation'
import { useActionState, useEffect } from 'react'
import { kisiEkle, type YeniKisiDurumu } from '@/lib/actions/kisi'
import { FREKANSLAR, HALKALAR, frekansGun, type Ayarlar } from '@/lib/hesaplama'

/**
 * Yeni kişi ekleme. Tek zorunlu alan: ad.
 *
 * Yeni tanıştığın birini kaydetmek saniyeler sürmeli — telefonu, sektörü,
 * kişisel detayı sonra detay sayfasından eklenebilir. Kaydedince doğrudan
 * o kişinin sayfasına gidiyoruz ki devamını orada doldurasın.
 */
export default function YeniKisiFormu({
  slug,
  ayarlar,
}: {
  slug: string
  ayarlar: Ayarlar
}) {
  const router = useRouter()
  const [durum, gonder, bekliyor] = useActionState<YeniKisiDurumu, FormData>(kisiEkle, {})

  useEffect(() => {
    if (durum.olusanId) router.push(`/${slug}/kisiler/${durum.olusanId}`)
  }, [durum, router, slug])


  return (
    <form action={gonder} className="kart yigin">
      <div className="alan">
        <label className="etiket" htmlFor="ad">
          Ad *
        </label>
        <input id="ad" name="ad" type="text" required autoFocus autoComplete="off" />
      </div>

      <div className="izgara">
        <div className="alan">
          <label className="etiket" htmlFor="halka">
            Halka
          </label>
          <select id="halka" name="halka" defaultValue="">
            <option value="">—</option>
            {HALKALAR.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
        </div>

        <div className="alan">
          <label className="etiket" htmlFor="frekans">
            Frekans
          </label>
          <select id="frekans" name="frekans" defaultValue="2">
            <option value="">—</option>
            {FREKANSLAR.map((f) => (
              <option key={f} value={f}>
                {f} · {frekansGun(f, ayarlar)} gün
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="alan">
        <label className="etiket" htmlFor="kategori">
          Kategori
        </label>
        <select id="kategori" name="kategori" defaultValue="">
          <option value="">—</option>
          {ayarlar.kategoriler.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </div>

      <div className="izgara">
        <div className="alan">
          <label className="etiket" htmlFor="rol">
            Rol / bağlam
          </label>
          <input id="rol" name="rol" type="text" />
        </div>
        <div className="alan">
          <label className="etiket" htmlFor="sirket">
            Şirket
          </label>
          <input id="sirket" name="sirket" type="text" />
        </div>
      </div>

      <div className="alan">
        <label className="etiket" htmlFor="telefon">
          Telefon
        </label>
        <input id="telefon" name="telefon" type="tel" />
      </div>

      <div className="alan">
        <label className="etiket" htmlFor="profil_baglantisi">
          LinkedIn profili
        </label>
        <input
          id="profil_baglantisi"
          name="profil_baglantisi"
          type="text"
          inputMode="url"
          placeholder="https://www.linkedin.com/in/ad-soyad"
        />
      </div>

      <div className="alan">
        <label className="etiket" htmlFor="kisisel_detay">
          Kişisel detay (iş dışı)
        </label>
        <span className="soluk">
          Nerede tanıştınız, ne konuştunuz, neyle ilgileniyor. Sistemin kalbi burası.
        </span>
        <textarea id="kisisel_detay" name="kisisel_detay" />
      </div>

      {durum.hata ? (
        <p className="hata" role="alert">
          {durum.hata}
        </p>
      ) : null}

      <button
        type="submit"
        className="btn btn-birincil btn-genis"
        disabled={bekliyor || Boolean(durum.olusanId)}
        style={{ minHeight: 54, fontSize: '1.05rem' }}
      >
        {bekliyor ? 'Ekleniyor…' : durum.olusanId ? 'Açılıyor…' : 'Ekle'}
      </button>

      <p className="soluk" style={{ margin: 0, textAlign: 'center' }}>
        Sadece ad zorunlu. Gerisini sonra doldurabilirsin.
      </p>
    </form>
  )
}
