import { baglariHesapla, kisiIzleri } from '@/lib/ortak-nokta'
import { beyinCiktisi, gecmisVerisi, kisileriGetir, tumBeyinKisileri } from '@/lib/sorgular'
import { etiketGoster, type GenelBeyin, type KisiBeyin } from '@/lib/beyin'
import AgHaritasi, { type AgBag, type AgDugum, type BeyinOnerisi } from './AgHaritasi'
import BeyinDugmesi from './BeyinDugmesi'

export const dynamic = 'force-dynamic'
// "Beyni güncelle" tuşu Python fonksiyonunu bekler
export const maxDuration = 60

/** Her kişinin en güçlü kaç öğrenilmiş bağı haritada çizilsin */
const BEYIN_BAG_SAYISI = 2

/**
 * K-04: Ağ haritası. Kişiler düğüm, ortak noktalar bağ. Hesap tamamen
 * lib/ortak-nokta.ts'te; bu sayfa yalnızca sonucu çizime hazırlar.
 */
export default async function AgSayfasi({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ kisi?: string }>
}) {
  const { slug } = await params
  const { kisi: seciliId } = await searchParams

  const [kisiler, gv, beyin, beyinKisi] = await Promise.all([
    kisileriGetir(),
    gecmisVerisi(),
    beyinCiktisi<GenelBeyin>('genel'),
    tumBeyinKisileri<KisiBeyin>(),
  ])
  const baglar = baglariHesapla(kisiler, gv.gecmis, gv.kurumlar, { sektor: true, sehir: true })
  const kurumHaritasi = new Map(gv.kurumlar.map((k) => [k.id, k]))

  const dugumler: AgDugum[] = kisiler.map((k) => ({
    id: k.id,
    ad: k.ad,
    halka: k.halka,
    altBaslik: [k.rol, k.sirket].filter(Boolean).join(' · '),
    izler: kisiIzleri(k, gv.gecmis, kurumHaritasi).map((i) => ({
      anahtar: i.kurumAnahtari,
      ad: i.kurumAdi,
      tur: i.kurumTuru,
      kesin: i.kesin,
    })),
  }))

  const agBaglar: AgBag[] = baglar.map((b) => ({
    a: b.a,
    b: b.b,
    noktalar: b.noktalar.map((n) => ({
      tur: n.tur,
      kurumTuru: n.kurumTuru ?? null,
      aciklama: n.aciklama,
      agirlik: n.agirlik,
      kesin: n.kesin,
      yakin: n.yakin ?? false,
    })),
  }))

  // öğrenme motoru: öğrenilmiş kişi↔kişi bağları ("Beyin" katmanı). Skorlar küçük ama sıralama
  // anlamlı; en güçlü skora göre 0..1 normalize edilip ortak nokta ağırlıklarıyla aynı ölçeğe çekilir.
  const adlar = new Map(kisiler.map((k) => [k.id, k.ad]))
  const enYuksek = Math.max(
    0,
    ...[...beyinKisi.values()].flatMap((v) => v.iliskili_kisiler.map((k) => k.skor)),
  )
  const bagIndeksi = new Map(agBaglar.map((b, i) => [[b.a, b.b].sort().join('|'), i]))
  if (enYuksek > 0) {
    for (const [kisiId, v] of beyinKisi) {
      if (!adlar.has(kisiId)) continue
      for (const k of v.iliskili_kisiler.filter((x) => adlar.has(x.kisi_id)).slice(0, BEYIN_BAG_SAYISI)) {
        const anahtar = [kisiId, k.kisi_id].sort().join('|')
        const nokta = {
          tur: 'beyin' as const,
          kurumTuru: null,
          aciklama: `Beyin öğrendi${k.neden.length ? `: ${k.neden.map(([e]) => etiketGoster(e, adlar)).join(', ')}` : ''}`,
          agirlik: 0.5 + 2.5 * (k.skor / enYuksek),
          kesin: true,
          yakin: false,
        }
        const i = bagIndeksi.get(anahtar)
        if (i === undefined) {
          bagIndeksi.set(anahtar, agBaglar.length)
          agBaglar.push({ a: kisiId, b: k.kisi_id, noktalar: [nokta] })
        } else if (!agBaglar[i].noktalar.some((n) => n.tur === 'beyin')) {
          agBaglar[i].noktalar.push(nokta)
        }
      }
    }
  }

  const beyinOnerileri: Record<string, BeyinOnerisi> = {}
  for (const [kisiId, v] of beyinKisi) {
    beyinOnerileri[kisiId] = {
      ozellikler: v.iliskili_ozellikler.slice(0, 3).map((o) => etiketGoster(o.etiket, adlar)),
      sonraki: v.sonraki.slice(0, 2).map((o) => etiketGoster(o.etiket, adlar)),
    }
  }
  const varsayimlar = (beyin?.veri.varsayimlar ?? [])
    .slice(0, 10)
    .map((v) => `${etiketGoster(v.kaynak, adlar)} ↔ ${etiketGoster(v.hedef, adlar)}`)

  return (
    <div className="yigin">
      <div>
        <h1>Ağ haritası</h1>
        <p className="soluk" style={{ margin: '4px 0 0' }}>
          Kişiler arasındaki ortak noktalar: aynı şirket, okul, bölüm, vakıf, dernek,
          sektör. Pembe çizgiler öğrenme motoru’in temaslardan öğrendiği bağlar. Bir kişiye dokun,
          bağlantıları ateşlensin.
        </p>
      </div>
      <BeyinDugmesi sonGuncelleme={beyin?.guncellendi ?? null} />
      {!gv.semaVar ? (
        <p className="hata">
          Geçmiş tabloları henüz kurulmadı; harita şimdilik yalnızca şirket ve sektör
          alanlarından çiziliyor. “supabase/migrations/0004_gecmis.sql” dosyasını Supabase
          SQL Editor’de çalıştır.
        </p>
      ) : null}
      <AgHaritasi
        slug={slug}
        dugumler={dugumler}
        baglar={agBaglar}
        seciliBaslangic={seciliId ?? null}
        beyinOnerileri={beyinOnerileri}
        varsayimlar={varsayimlar}
      />

      {beyin && beyin.veri.arkadas_yolu.length ? (
        <section className="kart">
          <div className="kart-baslik">
            <h2>Arkadaş yolunu ne öngörüyor?</h2>
            <span className="aralik" />
            <span className="soluk">öğrenme motoru · {beyin.veri.ozet.kayit} temastan öğrendi</span>
          </div>
          <p className="soluk" style={{ marginTop: 0 }}>
            Ofis dışı yüz yüze görüşmeye (ilişkinin derinleşmesi) giden özellikler. Artı: öngörür, eksi: uzaklaştırır.
          </p>
          <ul className="cizelge">
            {beyin.veri.arkadas_yolu.map((a) => (
              <li key={a.etiket}>
                <div className="satir">
                  <span>{etiketGoster(a.etiket)}</span>
                  <span className="aralik" />
                  <span className={a.w > 0 ? 'rozet rozet-GUNCEL' : 'rozet rozet-GECIKTI'}>
                    {a.w > 0 ? '+' : ''}
                    {a.w.toFixed(2)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
