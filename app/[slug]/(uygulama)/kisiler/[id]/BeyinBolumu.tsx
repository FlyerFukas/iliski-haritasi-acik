import Link from 'next/link'
import { etiketGoster, type KisiBeyin } from '@/lib/beyin'

/**
 * öğrenme motoru: bu kişi için öğrenen motorun gördükleri. Veri `npm run beyin` ile güncellenir.
 * "neden" = sonuca en çok katkı veren nöronlar (motorun katkida_bulunanlar / dayanak alanı).
 */
export default function BeyinBolumu({
  slug,
  veri,
  guncellendi,
  adlar,
}: {
  slug: string
  veri: KisiBeyin
  guncellendi: string
  adlar: Map<string, string>
}) {
  const neden = (n: [string, number][]) =>
    n.length ? `neden: ${n.map(([e]) => etiketGoster(e, adlar)).join(', ')}` : null
  const kisiler = veri.iliskili_kisiler.filter((k) => adlar.has(k.kisi_id))

  return (
    <details className="kart">
      <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
        Beynin gördükleri <span className="soluk">(öğrenme motoru)</span>
      </summary>
      <div className="yigin" style={{ marginTop: 12 }}>
        {kisiler.length ? (
          <div>
            <div className="etiket">Benzer örüntüdeki kişiler</div>
            {kisiler.slice(0, 5).map((k) => (
              <p key={k.kisi_id} style={{ margin: '4px 0 0' }}>
                <Link href={`/${slug}/kisiler/${k.kisi_id}`}>{adlar.get(k.kisi_id)}</Link>{' '}
                <span className="soluk">{neden(k.neden)}</span>
              </p>
            ))}
          </div>
        ) : null}

        {veri.iliskili_ozellikler.length ? (
          <div>
            <div className="etiket">Bu kişiyle birlikte görülenler</div>
            {veri.iliskili_ozellikler.slice(0, 5).map((o) => (
              <p key={o.etiket} style={{ margin: '4px 0 0' }}>
                {etiketGoster(o.etiket, adlar)} <span className="soluk">{neden(o.neden)}</span>
              </p>
            ))}
          </div>
        ) : null}

        {veri.sonraki.length ? (
          <div>
            <div className="etiket">Bundan sonra genelde ne gelir</div>
            {veri.sonraki.slice(0, 3).map((s) => (
              <p key={s.etiket} style={{ margin: '4px 0 0' }}>
                {etiketGoster(s.etiket, adlar)}{' '}
                <span className="soluk">
                  ({s.dayanak.map(([e, , olay]) => `${etiketGoster(e, adlar)} sonrası, ${olay} olay`).join('; ')})
                </span>
              </p>
            ))}
          </div>
        ) : null}

        <p className="soluk" style={{ margin: 0, fontSize: '0.8rem' }}>
          Son öğrenme:{' '}
          {new Intl.DateTimeFormat('tr-TR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Istanbul' }).format(
            new Date(guncellendi),
          )}
        </p>
      </div>
    </details>
  )
}
