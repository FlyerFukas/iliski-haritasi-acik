'use client'

import { useActionState } from 'react'
import { kisiGuncelle, type KisiDurumu } from '@/lib/actions/kisi'
import { FREKANSLAR, HALKALAR, frekansGun, type Ayarlar, type Kisi } from '@/lib/hesaplama'

/**
 * Kişi düzenleme formu. Kaydedince değişen her alanın eski değeri
 * `degisiklik_gecmisi`'ne yazılır — bunu server action yapar (lib/actions/kisi.ts).
 */
export default function KisiDuzenle({ kisi, ayarlar }: { kisi: Kisi; ayarlar: Ayarlar }) {
  const [durum, gonder, bekliyor] = useActionState<KisiDurumu, FormData>(kisiGuncelle, {})

  const metinAlani = (
    ad: keyof Kisi,
    etiket: string,
    tip: 'text' | 'tel' | 'email' | 'url' = 'text',
  ) => (
    <div className="alan">
      <label className="etiket" htmlFor={ad}>
        {etiket}
      </label>
      <input id={ad} name={ad} type={tip} defaultValue={(kisi[ad] as string) ?? ''} />
    </div>
  )

  const uzunAlan = (ad: keyof Kisi, etiket: string, ipucu?: string) => (
    <div className="alan">
      <label className="etiket" htmlFor={ad}>
        {etiket}
      </label>
      {ipucu ? <span className="soluk">{ipucu}</span> : null}
      <textarea id={ad} name={ad} defaultValue={(kisi[ad] as string) ?? ''} />
    </div>
  )


  return (
    <form action={gonder} className="kart yigin">
      <input type="hidden" name="id" value={kisi.id} />

      <div className="kart-baslik">
        <h2>Bilgiler</h2>
      </div>

      {metinAlani('ad', 'Ad')}

      <div className="izgara">
        <div className="alan">
          <label className="etiket" htmlFor="halka">
            Halka
          </label>
          <select id="halka" name="halka" defaultValue={kisi.halka ?? ''}>
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
          <select id="frekans" name="frekans" defaultValue={kisi.frekans ?? ''}>
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
        <select id="kategori" name="kategori" defaultValue={kisi.kategori ?? ''}>
          <option value="">—</option>
          {/* Kişinin mevcut kategorisi listeden çıkarılmış olabilir; onu da
              göster, yoksa kaydetmeye çalışınca değeri kaybederdi. */}
          {[
            ...ayarlar.kategoriler,
            ...(kisi.kategori && !ayarlar.kategoriler.includes(kisi.kategori)
              ? [kisi.kategori]
              : []),
          ].map((k) => (
            <option key={k} value={k}>
              {k}
              {ayarlar.kategoriler.includes(k) ? '' : ' (listede yok)'}
            </option>
          ))}
        </select>
      </div>

      <div className="alan">
        <label className="etiket" htmlFor="ozel_aralik_gun">
          Özel aralık (gün)
        </label>
        <span className="soluk">Doluysa frekansı geçersiz kılar. Boş bırak = frekansı kullan.</span>
        <input
          id="ozel_aralik_gun"
          name="ozel_aralik_gun"
          type="number"
          min={1}
          defaultValue={kisi.ozel_aralik_gun ?? ''}
        />
      </div>

      <div className="izgara">
        {metinAlani('rol', 'Rol / bağlam')}
        {metinAlani('sirket', 'Şirket')}
        {metinAlani('sektor', 'Sektör')}
        {metinAlani('sehir', 'Şehir')}
        {metinAlani('telefon', 'Telefon', 'tel')}
        {metinAlani('eposta', 'E-posta', 'email')}
      </div>

      {/* type=url değil: "linkedin.com/in/..." (https'siz) de kabul edilsin, sunucu normalize eder */}
      {metinAlani('profil_baglantisi', 'LinkedIn profili')}

      {uzunAlan(
        'kisisel_detay',
        'Kişisel detay (iş dışı)',
        'Hobi, memleket, çocuk… Ferrazzi sisteminin kalbi burası.',
      )}
      {uzunAlan('yapilacak_hamle', 'Yapılacak hamle', 'Bir sonraki teması ne olacak?')}
      {uzunAlan('notlar', 'Notlar')}

      {durum.hata ? (
        <p className="hata" role="alert">
          {durum.hata}
        </p>
      ) : null}

      {durum.kaydedildi && !durum.hata ? (
        <p className="rozet rozet-GUNCEL" role="status" style={{ padding: '10px 14px' }}>
          {durum.degisenSayisi
            ? `✓ Kaydedildi — ${durum.degisenSayisi} alan değişti, eski değerler geçmişe yazıldı`
            : '✓ Değişiklik yok'}
        </p>
      ) : null}

      <button type="submit" className="btn btn-birincil btn-genis" disabled={bekliyor}>
        {bekliyor ? 'Kaydediliyor…' : 'Kaydet'}
      </button>
    </form>
  )
}
