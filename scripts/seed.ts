/**
 * data/seed.json → Supabase yükleyici.
 *
 *   npm run seed            # yükle (var olan kişilere DOKUNMAZ)
 *   npm run seed:kontrol    # hiçbir şey yazma, sadece doğrula ve raporla
 *   npm run seed -- --guncelle
 *                           # var olan kişilerin alanlarını da seed'deki değerlerle
 *                           # güncelle (elle yaptığın düzenlemeler kaybolur — dikkat)
 *
 * Tasarım kararı: varsayılan davranış "yalnızca eksik olanı ekle". Böylece seed
 * ikinci kez çalıştığında arayüzden yaptığın düzenlemeleri ezmez (CLAUDE.md kural 1).
 */

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { anahtar } from '../lib/turkce.ts'
import { kurumAnahtari } from '../lib/ortak-nokta.ts'

const BURASI = dirname(fileURLToPath(import.meta.url))
const SEED_YOLU = resolve(BURASI, '../data/seed.json')

const bayraklar = new Set(process.argv.slice(2))
const SADECE_KONTROL = bayraklar.has('--kontrol')
const GUNCELLE = bayraklar.has('--guncelle')

/* ------------------------------------------------------------ seed biçimi */

interface SeedKisi {
  ad: string
  halka: string | null
  kategori: string | null
  frekans: number | null
  ozel_aralik_gun: number | null
  rol: string | null
  sirket: string | null
  sektor: string | null
  sehir: string | null
  telefon: string | null
  eposta: string | null
  profil_baglantisi: string | null
  kisisel_detay: string | null
  yapilacak_hamle: string | null
  notlar: string | null
  /** JSON yedeğinden gelir; ilk seed dosyasında yok, o yüzden isteğe bağlı. */
  arsiv?: boolean
}

interface SeedTemas {
  kisi: string
  tarih: string
  yontem: string | null
  ofis_disi_yuz_yuze: boolean
  not: string | null
  /** JSON yedeğinden gelir; ilk seed dosyasında yok. */
  iptal?: boolean
}

interface SeedHedef {
  hedef_isim: string
  sirket_rol?: string | null
  neden?: string | null
  ortak_baglanti?: string | null
  yaklasim_plani?: string | null
  durum?: string | null
  not?: string | null
}

interface SeedDosya {
  ayarlar: { frekans_gun: Record<string, number> }
  kisiler: SeedKisi[]
  temaslar: SeedTemas[]
  hedefler: SeedHedef[]
  /** K-04 geçmiş — JSON yedeğinde var, ilk seed.json'da yok. */
  gecmis?: {
    kisi: string | null
    kurum: string | null
    kurum_turu: string | null
    alan: string | null
    baslangic_yil: number | null
    bitis_yil: number | null
    guncel: boolean
    not: string | null
  }[]
}

/* ------------------------------------------------------------- yardımcılar */

const yaz = (...parcalar: unknown[]) => console.log(...parcalar)
const basliK = (metin: string) => yaz(`\n── ${metin} ${'─'.repeat(Math.max(0, 58 - metin.length))}`)

function oldur(mesaj: string): never {
  console.error(`\n✗ ${mesaj}\n`)
  process.exit(1)
}

/** Bir temas kaydının kimliği — tekrar yüklemeyi engellemek için. */
function temasImzasi(kisiId: string, tarih: string, yontem: string | null, not: string | null) {
  return [kisiId, tarih, yontem ?? '', (not ?? '').trim()].join('␟')
}

/* -------------------------------------------------------------------- ana */

async function main() {
  yaz('İlişki Haritası — seed yükleyici')
  if (SADECE_KONTROL) yaz('(kontrol modu: hiçbir şey yazılmayacak)')
  if (GUNCELLE) yaz('(güncelle modu: var olan kişilerin alanları seed ile EZİLECEK)')

  /* 1 — dosyayı oku ve doğrula ---------------------------------------- */

  basliK('1. seed.json okunuyor')

  let seed: SeedDosya
  try {
    seed = JSON.parse(readFileSync(SEED_YOLU, 'utf8')) as SeedDosya
  } catch (hata) {
    oldur(`seed.json okunamadı (${SEED_YOLU}): ${(hata as Error).message}`)
  }

  const kisiler = seed.kisiler ?? []
  const temaslar = seed.temaslar ?? []
  const hedefler = seed.hedefler ?? []

  yaz(`  kişi     : ${kisiler.length}`)
  yaz(`  temas    : ${temaslar.length}`)
  yaz(`  hedef    : ${hedefler.length}`)
  yaz(`  ayarlar  : 1=${seed.ayarlar.frekans_gun['1']}g  2=${seed.ayarlar.frekans_gun['2']}g  3=${seed.ayarlar.frekans_gun['3']}g`)

  // ad tekrarı var mı (normalize edilmiş halde)
  const adAnahtarlari = new Map<string, string>()
  for (const k of kisiler) {
    if (!k.ad?.trim()) oldur('Adı boş bir kişi kaydı var.')
    const a = anahtar(k.ad)
    const oncekiAd = adAnahtarlari.get(a)
    if (oncekiAd) oldur(`seed.json içinde çakışan iki isim: "${oncekiAd}" ve "${k.ad}"`)
    adAnahtarlari.set(a, k.ad)
  }

  // her temasın kişisi listede var mı
  const cozulmeyen = temaslar.filter((t) => !adAnahtarlari.has(anahtar(t.kisi)))
  if (cozulmeyen.length) {
    oldur(
      `Şu temasların kişisi kisiler listesinde yok:\n` +
        cozulmeyen.map((t) => `    ${t.tarih} — "${t.kisi}"`).join('\n'),
    )
  }
  yaz('  ✓ isim bütünlüğü tamam — her temasın kişisi listede')

  if (SADECE_KONTROL) {
    yaz('\n✓ Kontrol tamam. Yazma yapılmadı.\n')
    return
  }

  /* 2 — bağlan --------------------------------------------------------- */

  basliK('2. Supabase bağlantısı')

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anahtarGizli = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !anahtarGizli) {
    oldur(
      'NEXT_PUBLIC_SUPABASE_URL ve/veya SUPABASE_SERVICE_ROLE_KEY eksik.\n' +
        '  ".env.local" dosyasını ".env.local.example" örneğine göre doldur.',
    )
  }

  const db = createClient(url, anahtarGizli, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { error: baglantiHatasi } = await db.from('kisiler').select('id').limit(1)
  if (baglantiHatasi) {
    oldur(
      `Bağlantı/şema hatası: ${baglantiHatasi.message}\n` +
        '  "supabase/migrations/0001_init.sql" dosyasını Supabase SQL Editor\'de çalıştırdın mı?',
    )
  }
  yaz(`  ✓ bağlandı: ${url}`)

  /* 3 — ayarlar -------------------------------------------------------- */

  basliK('3. Ayarlar')

  const { error: ayarHatasi } = await db.from('ayarlar').upsert(
    {
      tek_satir: true,
      frekans_1_gun: seed.ayarlar.frekans_gun['1'],
      frekans_2_gun: seed.ayarlar.frekans_gun['2'],
      frekans_3_gun: seed.ayarlar.frekans_gun['3'],
    },
    { onConflict: 'tek_satir' },
  )
  if (ayarHatasi) oldur(`Ayarlar yazılamadı: ${ayarHatasi.message}`)
  yaz('  ✓ frekans günleri yazıldı')

  /* 4 — kişiler -------------------------------------------------------- */

  basliK('4. Kişiler')

  const satirlar = kisiler.map((k) => ({
    ad: k.ad.trim(),
    halka: k.halka,
    kategori: k.kategori,
    frekans: k.frekans,
    ozel_aralik_gun: k.ozel_aralik_gun,
    rol: k.rol,
    sirket: k.sirket,
    sektor: k.sektor,
    sehir: k.sehir,
    telefon: k.telefon,
    eposta: k.eposta,
    profil_baglantisi: k.profil_baglantisi,
    kisisel_detay: k.kisisel_detay,
    yapilacak_hamle: k.yapilacak_hamle,
    notlar: k.notlar,
    // JSON yedeğinden geri yüklerken arşiv durumu korunmalı; yoksa arşivdeki
    // kişiler listeye geri döner.
    arsiv: k.arsiv ?? false,
  }))

  const { data: oncekiler } = await db.from('kisiler').select('ad')
  const oncekiSayi = oncekiler?.length ?? 0

  const { error: kisiHatasi } = await db
    .from('kisiler')
    .upsert(satirlar, { onConflict: 'ad', ignoreDuplicates: !GUNCELLE })
  if (kisiHatasi) oldur(`Kişiler yazılamadı: ${kisiHatasi.message}`)

  const { data: tumKisiler, error: okumaHatasi } = await db.from('kisiler').select('id, ad')
  if (okumaHatasi || !tumKisiler) oldur(`Kişiler okunamadı: ${okumaHatasi?.message}`)

  yaz(`  önceden kayıtlı : ${oncekiSayi}`)
  yaz(`  yeni eklenen    : ${tumKisiler.length - oncekiSayi}`)
  yaz(`  toplam          : ${tumKisiler.length}`)
  if (!GUNCELLE && oncekiSayi > 0) {
    yaz('  not: var olan kişilerin alanlarına dokunulmadı (--guncelle ile ezilebilir)')
  }

  // ad → id haritası (Türkçe normalize ile)
  const kimlik = new Map<string, string>()
  for (const k of tumKisiler) kimlik.set(anahtar(k.ad), k.id)

  /* 5 — temaslar ------------------------------------------------------- */

  basliK('5. Temaslar')

  const { data: mevcutTemaslar, error: temasOkumaHatasi } = await db
    .from('temaslar')
    .select('kisi_id, tarih, yontem, not')
  if (temasOkumaHatasi) oldur(`Temaslar okunamadı: ${temasOkumaHatasi.message}`)

  const mevcutImzalar = new Set(
    (mevcutTemaslar ?? []).map((t) =>
      temasImzasi(t.kisi_id as string, t.tarih as string, t.yontem as string | null, t.not as string | null),
    ),
  )

  const eklenecek: Array<Record<string, unknown>> = []
  let atlanan = 0

  for (const t of temaslar) {
    const kisiId = kimlik.get(anahtar(t.kisi))
    if (!kisiId) oldur(`"${t.kisi}" için kişi id'si bulunamadı — beklenmedik durum.`)

    const imza = temasImzasi(kisiId, t.tarih, t.yontem, t.not)
    if (mevcutImzalar.has(imza)) {
      atlanan++
      continue
    }
    mevcutImzalar.add(imza) // seed içinde birebir aynı iki satır varsa ikincisini de atla

    eklenecek.push({
      kisi_id: kisiId,
      tarih: t.tarih,
      yontem: t.yontem,
      ofis_disi_yuz_yuze: t.ofis_disi_yuz_yuze ?? false,
      not: t.not,
      // İptal işareti korunmalı; yoksa iptal edilmiş temaslar sayımlara geri girer.
      iptal: t.iptal ?? false,
    })
  }

  if (eklenecek.length) {
    const { error: temasHatasi } = await db.from('temaslar').insert(eklenecek)
    if (temasHatasi) oldur(`Temaslar yazılamadı: ${temasHatasi.message}`)
  }

  yaz(`  yeni eklenen : ${eklenecek.length}`)
  yaz(`  zaten vardı  : ${atlanan}`)

  /* 6 — hedefler ------------------------------------------------------- */

  basliK('6. Hedefler')

  if (hedefler.length === 0) {
    yaz('  seed.json içinde hedef yok — atlandı')
  } else {
    const { error: hedefHatasi } = await db.from('hedefler').upsert(
      hedefler.map((h) => ({
        hedef_isim: h.hedef_isim,
        sirket_rol: h.sirket_rol ?? null,
        neden: h.neden ?? null,
        ortak_baglanti: h.ortak_baglanti ?? null,
        yaklasim_plani: h.yaklasim_plani ?? null,
        durum: h.durum ?? 'Araştırma',
        not: h.not ?? null,
      })),
      { onConflict: 'hedef_isim', ignoreDuplicates: !GUNCELLE },
    )
    if (hedefHatasi) oldur(`Hedefler yazılamadı: ${hedefHatasi.message}`)
    yaz(`  ✓ ${hedefler.length} hedef işlendi`)
  }

  /* 6b — geçmiş (K-04) ----------------------------------------------- */

  basliK('6b. Geçmiş')

  const gecmisler = seed.gecmis ?? []
  if (gecmisler.length === 0) {
    yaz('  yedekte geçmiş kaydı yok — atlandı')
  } else {
    const { error: tabloHatasi } = await db.from('kisi_gecmisi').select('id').limit(1)
    if (tabloHatasi) {
      oldur(
        `Yedekte ${gecmisler.length} geçmiş kaydı var ama tablo yok. ` +
          'Önce supabase/migrations/0004_gecmis.sql çalıştır.',
      )
    }
    const { data: mevcut } = await db
      .from('kisi_gecmisi')
      .select('kisi_id, kurum_id, alan, baslangic_yil')
      .eq('arsiv', false)
    const imza = (k: string, u: string, a: string | null, y: number | null) => `${k}|${u}|${anahtar(a)}|${y ?? ''}`
    const varOlan = new Set((mevcut ?? []).map((m) => imza(m.kisi_id, m.kurum_id, m.alan, m.baslangic_yil)))
    let eklenen = 0
    for (const g of gecmisler) {
      const kisiId = kimlik.get(anahtar(g.kisi))
      const kurumAnah = kurumAnahtari(g.kurum)
      if (!kisiId || !kurumAnah) oldur(`Geçmiş kaydı eşlenemedi: ${g.kisi} / ${g.kurum}`)
      // var olan kurumun adına/türüne dokunma; yoksa ekle
      let { data: kurum } = await db.from('kurumlar').select('id').eq('anahtar', kurumAnah).maybeSingle()
      if (!kurum) {
        const { data, error: kurumHatasi } = await db
          .from('kurumlar')
          .insert({ ad: g.kurum, anahtar: kurumAnah, tur: g.kurum_turu ?? 'diger' })
          .select('id')
          .single()
        if (kurumHatasi || !data) oldur(`Kurum yazılamadı: ${kurumHatasi?.message}`)
        kurum = data
      }
      if (varOlan.has(imza(kisiId, kurum.id, g.alan, g.baslangic_yil))) continue
      const { error } = await db.from('kisi_gecmisi').insert({
        kisi_id: kisiId,
        kurum_id: kurum.id,
        alan: g.alan,
        baslangic_yil: g.baslangic_yil,
        bitis_yil: g.bitis_yil,
        guncel: g.guncel,
        not: g.not,
      })
      if (error) oldur(`Geçmiş yazılamadı: ${error.message}`)
      eklenen++
    }
    yaz(`  ✓ ${gecmisler.length} geçmiş kaydı işlendi, ${eklenen} yeni eklendi`)
  }

  /* 7 — doğrulama ------------------------------------------------------ */

  basliK('7. Doğrulama')

  const say = async (tablo: string) => {
    const { count, error } = await db.from(tablo).select('*', { count: 'exact', head: true })
    if (error) oldur(`${tablo} sayılamadı: ${error.message}`)
    return count ?? 0
  }

  const kisiSayi = await say('kisiler')
  const temasSayi = await say('temaslar')
  const hedefSayi = await say('hedefler')

  const kontrol = (ad: string, gercek: number, beklenen: number) => {
    const isaret = gercek === beklenen ? '✓' : '✗'
    yaz(`  ${isaret} ${ad.padEnd(9)}: ${gercek} (beklenen ${beklenen})`)
    return gercek === beklenen
  }

  const hepsiTamam =
    [
      kontrol('kişi', kisiSayi, kisiler.length),
      kontrol('temas', temasSayi, temaslar.length),
      kontrol('hedef', hedefSayi, hedefler.length),
    ].every(Boolean)

  if (hepsiTamam) {
    yaz('\n✓ Seed tamam. Veriler Supabase\'de.\n')
  } else {
    yaz(
      '\n! Sayılar seed.json ile birebir tutmuyor.\n' +
        '  Bu, veritabanında seed dışında kayıt olduğu anlamına gelebilir (sorun olmayabilir).\n',
    )
  }
}

main().catch((hata) => {
  console.error('\n✗ Beklenmedik hata:', hata)
  process.exit(1)
})
