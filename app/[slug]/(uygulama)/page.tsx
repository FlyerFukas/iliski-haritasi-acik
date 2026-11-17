import Link from 'next/link'
import {
  DURUM_ETIKET,
  DURUM_SIRASI,
  FREKANSLAR,
  HALKALAR,
  aciliyetSirasi,
  kalanGunGoster,
  tarihGoster,
  type Durum,
} from '@/lib/hesaplama'
import { anlikDurum, kullanilanKategoriler } from '@/lib/sorgular'

export const dynamic = 'force-dynamic'

export default async function Panel({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const { ozetler, bugun, ayarlar } = await anlikDurum()

  const sayac = (durum: Durum) => ozetler.filter((o) => o.durum === durum).length

  const aranacaklar = ozetler
    .filter((o) => o.durum === 'GECIKTI' || o.durum === 'YAKLASIYOR')
    .sort(aciliyetSirasi)

  const ucYontem = ozetler.filter((o) => o.ucYontemTamam).length
  const arkadas = ozetler.filter((o) => o.arkadasYolu).length
  const kayitYok = sayac('KAYIT_YOK')
  const gecikti = sayac('GECIKTI')

  return (
    <div className="yigin">
      <div className="satir">
        <h1>Panel</h1>
        <span className="aralik" />
        <span className="soluk">{tarihGoster(bugun)}</span>
      </div>

      {/* ---------------------------------------------------- dört sayaç */}
      <div className="izgara izgara-4">
        {DURUM_SIRASI.map((durum) => (
          <Link
            key={durum}
            href={`/${slug}/kisiler?durum=${durum}`}
            className={`sayac sayac-${durum}`}
          >
            <span className="sayac-rakam">{sayac(durum)}</span>
            <span className="sayac-etiket">{DURUM_ETIKET[durum].replace('⚠ ', '')}</span>
          </Link>
        ))}
      </div>

      {/* ------------------------------------------- bugün aranacaklar */}
      <section className="kart">
        <div className="kart-baslik">
          <h2>Bugün aranacaklar</h2>
          <span className="aralik" />
          <span className="soluk">{aranacaklar.length} kişi</span>
        </div>

        {aranacaklar.length === 0 ? (
          <p className="bos-durum">Gecikmiş veya yaklaşan temas yok. 👏</p>
        ) : (
          <div className="yigin" style={{ gap: 12 }}>
            {aranacaklar.map((o) => (
              <div
                key={o.kisi.id}
                style={{ borderTop: '1px solid var(--kenar)', paddingTop: 12 }}
              >
                <div className="satir">
                  <Link href={`/${slug}/kisiler/${o.kisi.id}`} style={{ fontWeight: 650 }}>
                    {o.kisi.ad}
                  </Link>
                  <span className={`rozet rozet-${o.durum}`}>
                    {kalanGunGoster(o.kalanGun)}
                  </span>
                  <span className="aralik" />
                  <Link
                    href={`/${slug}/temas?kisi=${o.kisi.id}`}
                    className="btn btn-kucuk btn-birincil"
                  >
                    Temas ekle
                  </Link>
                </div>
                {o.kisi.yapilacak_hamle ? (
                  <p className="soluk" style={{ margin: '6px 0 0' }}>
                    {o.kisi.yapilacak_hamle}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ------------------------------------------------ haftalık rutin */}
      <section className="kart">
        <div className="kart-baslik">
          <h2>Pazar ritüeli</h2>
          <span className="aralik" />
          <span className="soluk">haftalık bakım</span>
        </div>
        <ol className="yigin" style={{ gap: 10, paddingLeft: 20, margin: 0 }}>
          <li>
            <Link href={`/${slug}/kisiler?durum=GECIKTI`}>
              Geciken {gecikti} kişiyi gözden geçir
            </Link>
            <div className="soluk">Her biri için bu hafta ne yapacağını belirle.</div>
          </li>
          <li>
            <Link href={`/${slug}/kisiler?durum=KAYIT_YOK`}>
              Temas kaydı olmayan {kayitYok} kişiyi ele al
            </Link>
            <div className="soluk">
              En az birine bir çınlama gönder — süreklilik olmazsa ateş söner.
            </div>
          </li>
          <li>
            <Link href={`/${slug}/kisiler?q=`}>Kişisel detayları güncelle</Link>
            <div className="soluk">
              Bu hafta öğrendiğin iş dışı bilgileri (hobi, memleket, çocuk) yaz.
            </div>
          </li>
          <li>
            <Link href={`/${slug}/hedefler`}>Tanışmak istediklerini gözden geçir</Link>
            <div className="soluk">Bir hedefe bu hafta bir adım at.</div>
          </li>
          <li>
            <Link href={`/${slug}/ayarlar`}>Yedek al</Link>
            <div className="soluk">Ayda bir yeterli.</div>
          </li>
        </ol>
      </section>

      {/* --------------------------------------------- ilişki derinliği */}
      <section className="kart">
        <div className="kart-baslik">
          <h2>İlişki derinliği</h2>
        </div>
        <div className="satir" style={{ gap: 24 }}>
          <div>
            <div className="sayac-rakam">{ucYontem}</div>
            <div className="soluk">3 yöntem tamam</div>
          </div>
          <div>
            <div className="sayac-rakam">{arkadas}</div>
            <div className="soluk">arkadaşa dönüşmüş</div>
          </div>
          <div>
            <div className="sayac-rakam">{ozetler.length}</div>
            <div className="soluk">toplam kişi</div>
          </div>
        </div>
        <p className="soluk" style={{ marginBottom: 0 }}>
          3 farklı yöntemle temas = karşı tarafın belleğine yerleşme. Ofis dışında
          2 yüz yüze görüşme = tanıdığın arkadaşa dönüşmesi.
        </p>
      </section>

      {/* --------------------------------------------------- dağılımlar */}
      <div className="izgara">
        <Dagilim
          baslik="Halka"
          slug={slug}
          alan="halka"
          satirlar={HALKALAR.map((h) => ({
            etiket: h,
            sayi: ozetler.filter((o) => o.kisi.halka === h).length,
          }))}
          toplam={ozetler.length}
        />
        <Dagilim
          baslik="Frekans"
          slug={slug}
          alan="frekans"
          satirlar={FREKANSLAR.map((f) => ({
            etiket: String(f),
            sayi: ozetler.filter((o) => o.kisi.frekans === f).length,
          }))}
          toplam={ozetler.length}
        />
      </div>

      <Dagilim
        baslik="Kategori"
        slug={slug}
        alan="kategori"
        satirlar={kullanilanKategoriler(ayarlar, ozetler).map((k) => ({
          etiket: k,
          sayi: ozetler.filter((o) => o.kisi.kategori === k).length,
        })).filter((s) => s.sayi > 0)}
        toplam={ozetler.length}
      />
    </div>
  )
}

/** Basit dağılım listesi — her satır kişiler ekranındaki filtreye götürür. */
function Dagilim({
  baslik,
  slug,
  alan,
  satirlar,
  toplam,
}: {
  baslik: string
  slug: string
  alan: string
  satirlar: Array<{ etiket: string; sayi: number }>
  toplam: number
}) {
  return (
    <section className="kart">
      <div className="kart-baslik">
        <h2>{baslik}</h2>
      </div>
      <div className="yigin" style={{ gap: 8 }}>
        {satirlar.map((s) => (
          <Link
            key={s.etiket}
            href={`/${slug}/kisiler?${alan}=${encodeURIComponent(s.etiket)}`}
            className="satir"
            style={{ color: 'inherit', textDecoration: 'none', gap: 10 }}
          >
            <span style={{ minWidth: 0, flex: '0 1 auto' }}>{s.etiket}</span>
            <span className="aralik" />
            <span
              aria-hidden="true"
              style={{
                height: 8,
                width: `${toplam ? Math.round((s.sayi / toplam) * 100) : 0}%`,
                minWidth: s.sayi ? 6 : 0,
                background: 'var(--vurgu)',
                borderRadius: 4,
                flex: '0 0 auto',
              }}
            />
            <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{s.sayi}</strong>
          </Link>
        ))}
      </div>
    </section>
  )
}
