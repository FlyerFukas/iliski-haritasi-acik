/**
 * Excel'deki elle yapılmış güncellemeleri uygulamaya taşır.
 *
 *   npm run excel:senkron -- "<excel yolu>"          # KURU ÇALIŞMA, yazmaz
 *   npm run excel:senkron -- "<excel yolu>" --uygula # gerçekten yazar
 *
 * Yaptıkları:
 *   1. AD_ESLEME'deki kişilerin adını Excel'deki tam haliyle günceller
 *      (temas geçmişi korunur — yeni kayıt açmaz)
 *   2. Eşleşen her kişide Excel'de DOLU olan alanları uygular
 *      (Excel'de boş olan alana DOKUNMAZ — uygulama daha güncel olabilir)
 *   3. Excel'de olup uygulamada olmayan kişileri ekler
 *   4. Excel'de olup uygulamada olmayan temasları ekler
 *   5. SIL listesindeki deneme kayıtlarını siler
 *   6. ARSIV listesindeki kişileri arşivler
 *
 * Her alan değişikliği degisiklik_gecmisi'ne yazılır (CLAUDE.md kural 1).
 */

import { createClient } from '@supabase/supabase-js'
import XLSX from 'xlsx'
import { anahtar } from '../lib/turkce.ts'

const DOSYA = process.argv[2]
const UYGULA = process.argv.includes('--uygula')

if (!DOSYA) {
  console.error('✗ Excel yolu ver.')
  process.exit(1)
}

/* --------------------------------------------------------- kullanıcı kararı */

/** Excel'deki tam ad  ←  uygulamadaki mevcut ad. Furkan onayladı. */
const AD_ESLEME: Record<string, string> = {
  // Örnek: Excel'de notla yazılmış ad  ←  uygulamadaki kısa ad
  'Ayşe Yılmaz (kongre)': 'Ayşe Yılmaz',
  'Ali Demir etkinlik': 'Ali Demir',
}

const SIL = ['deneme', 'aaaa']
const ARSIVLE = ['Zeynep Kaya']

/* ------------------------------------------------------------------ kurulum */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const gizli = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !gizli) {
  console.error('✗ Supabase ortam değişkenleri yok.')
  process.exit(1)
}
const db = createClient(url, gizli, { auth: { persistSession: false } })

const ESLEME: Array<[number, string]> = [
  [1, 'halka'], [2, 'kategori'], [3, 'frekans'], [4, 'rol'], [5, 'sirket'],
  [6, 'sektor'], [7, 'sehir'], [8, 'telefon'], [9, 'eposta'],
  [19, 'kisisel_detay'], [20, 'yapilacak_hamle'], [21, 'profil_baglantisi'],
  [22, 'notlar'], [23, 'ozel_aralik_gun'],
]
const SAYISAL = new Set(['frekans', 'ozel_aralik_gun'])

const duz = (v: unknown): string | null => {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return s === '' ? null : s
}
const seriTarih = (s: unknown): string | null =>
  typeof s === 'number'
    ? new Date(Date.UTC(1899, 11, 30) + s * 86_400_000).toISOString().slice(0, 10)
    : duz(s)

const kisalt = (s: string | null, n = 46) =>
  s === null ? '(boş)' : s.length > n ? s.slice(0, n) + '…' : s

/* --------------------------------------------------------------------- oku */

const wb = XLSX.readFile(DOSYA)
const exSatirlar = XLSX.utils
  .sheet_to_json<unknown[]>(wb.Sheets['Ana Liste'], { header: 1, defval: null })
  .slice(1)
  .filter((r) => duz(r[0]))

const exTemaslar = XLSX.utils
  .sheet_to_json<unknown[]>(wb.Sheets['Temas Günlüğü'], { header: 1, defval: null })
  .slice(1)
  .filter((r) => r[0] && duz(r[1]))

const { data: kisilerDb, error: e1 } = await db.from('kisiler').select('*')
if (e1) { console.error(`✗ ${e1.message}`); process.exit(1) }
const { data: temaslarDb } = await db.from('temaslar').select('id, kisi_id, tarih, yontem, not')

console.log(UYGULA ? '⚠  UYGULAMA MODU — veritabanına YAZILACAK\n' : 'Kuru çalışma — hiçbir şey yazılmayacak\n')
console.log(`Excel: ${DOSYA}`)
console.log(`Kişi : Excel ${exSatirlar.length}  ↔  uygulama ${kisilerDb!.length}\n`)

// anahtar → db kaydı
const dbHarita = new Map(kisilerDb!.map((k) => [anahtar(k.ad as string), k]))
// eşleme uygulandıktan sonraki hedef: excel adı → db kaydı
const cozum = new Map<string, Record<string, unknown>>()
for (const r of exSatirlar) {
  const exAd = String(r[0])
  const eskiAd = AD_ESLEME[exAd]
  const kayit = eskiAd ? dbHarita.get(anahtar(eskiAd)) : dbHarita.get(anahtar(exAd))
  if (kayit) cozum.set(exAd, kayit as Record<string, unknown>)
}

const auditKuyrugu: Array<Record<string, unknown>> = []
const audit = (id: string, alan: string, eski: string | null, yeni: string | null) =>
  auditKuyrugu.push({ tablo: 'kisiler', kayit_id: id, alan, eski_deger: eski, yeni_deger: yeni })

/* ------------------------------------------------------------ 1. ad değişimi */

console.log('── 1. Ad güncellemeleri ──────────────────────────────────')
let adSayaci = 0
for (const [yeniAd, eskiAd] of Object.entries(AD_ESLEME)) {
  const kayit = dbHarita.get(anahtar(eskiAd))
  if (!kayit) { console.log(`  ⚠ "${eskiAd}" bulunamadı, atlandı`); continue }
  if (kayit.ad === yeniAd) continue
  console.log(`  ${String(kayit.ad).padEnd(22)} → ${yeniAd}`)
  adSayaci++
  if (UYGULA) {
    const { error } = await db.from('kisiler').update({ ad: yeniAd }).eq('id', kayit.id)
    if (error) { console.error(`  ✗ ${error.message}`); process.exit(1) }
    audit(kayit.id as string, 'ad', kayit.ad as string, yeniAd)
    kayit.ad = yeniAd
  }
}
if (adSayaci === 0) console.log('  (değişiklik yok)')

/* --------------------------------------------------------- 2. alan güncelleme */

console.log('\n── 2. Alan güncellemeleri (Excel\'de dolu olanlar) ────────')
let alanSayaci = 0
for (const r of exSatirlar) {
  const kayit = cozum.get(String(r[0]))
  if (!kayit) continue

  const yeniDegerler: Record<string, unknown> = {}
  for (const [idx, alan] of ESLEME) {
    const e = duz(r[idx])
    if (e === null) continue // Excel'de boş → dokunma
    const u = duz(kayit[alan])
    if (e === u) continue
    if (SAYISAL.has(alan) && Number(e) === Number(u)) continue

    yeniDegerler[alan] = SAYISAL.has(alan) ? Number(e) : e
    console.log(`  ${String(kayit.ad).padEnd(22)} ${alan}`)
    console.log(`      önce : ${kisalt(u)}`)
    console.log(`      sonra: ${kisalt(e)}`)
    alanSayaci++
    if (UYGULA) audit(kayit.id as string, alan, u, e)
  }

  if (UYGULA && Object.keys(yeniDegerler).length) {
    const { error } = await db.from('kisiler').update(yeniDegerler).eq('id', kayit.id)
    if (error) { console.error(`  ✗ ${error.message}`); process.exit(1) }
  }
}
if (alanSayaci === 0) console.log('  (değişiklik yok)')

/* -------------------------------------------------------------- 3. yeni kişi */

console.log('\n── 3. Yeni kişiler ───────────────────────────────────────')
const yeniKisiler = exSatirlar.filter((r) => !cozum.has(String(r[0])))
for (const r of yeniKisiler) {
  const satir: Record<string, unknown> = { ad: String(r[0]).trim() }
  for (const [idx, alan] of ESLEME) {
    const e = duz(r[idx])
    if (e === null) continue
    satir[alan] = SAYISAL.has(alan) ? Number(e) : e
  }
  console.log(`  + ${String(satir.ad).padEnd(26)} ${satir.halka ?? '—'} / frekans ${satir.frekans ?? '—'}`)
  if (UYGULA) {
    const { data, error } = await db.from('kisiler').insert(satir).select('id, ad').single()
    if (error) { console.error(`  ✗ ${error.message}`); process.exit(1) }
    cozum.set(String(r[0]), data as Record<string, unknown>)
    dbHarita.set(anahtar(data.ad as string), data)
  } else {
    // Kuru çalışmada da sahte bir kimlik ver: yoksa bu kişilere ait temaslar
    // "kişi bulunamadı" diye görünür ve özet gerçekte olacaktan az çıkar.
    const sahte = { id: `yeni:${satir.ad}`, ad: satir.ad, yeni: true }
    cozum.set(String(r[0]), sahte)
    dbHarita.set(anahtar(String(satir.ad)), sahte)
  }
}
if (yeniKisiler.length === 0) console.log('  (yok)')

/* ---------------------------------------------------------------- 4. temaslar */

console.log('\n── 4. Yeni temaslar ──────────────────────────────────────')

const imza = (kisiId: string, tarih: string, yontem: string | null, not: string | null) =>
  [kisiId, tarih, yontem ?? '', (not ?? '').trim()].join('␟')

// Aynı imzadan kaç tane var — Excel'de 2, veritabanında 1 ise 1 tane daha eklenmeli.
const dbSayim = new Map<string, number>()
for (const t of temaslarDb ?? []) {
  const k = imza(t.kisi_id as string, t.tarih as string, t.yontem as string | null, t.not as string | null)
  dbSayim.set(k, (dbSayim.get(k) ?? 0) + 1)
}

const exSayim = new Map<string, { adet: number; satir: unknown[]; kisiId: string }>()
let cozulmeyen = 0
for (const r of exTemaslar) {
  const exAd = String(r[1])
  const kayit = cozum.get(exAd) ?? dbHarita.get(anahtar(exAd))
  if (!kayit) {
    console.log(`  ⚠ "${exAd}" için kişi bulunamadı — temas atlandı (${seriTarih(r[0])})`)
    cozulmeyen++
    continue
  }
  const k = imza(kayit.id as string, seriTarih(r[0])!, duz(r[2]), duz(r[4]))
  const v = exSayim.get(k)
  if (v) v.adet++
  else exSayim.set(k, { adet: 1, satir: r, kisiId: kayit.id as string })
}

const eklenecekTemaslar: Array<Record<string, unknown>> = []
for (const [k, v] of exSayim) {
  const eksik = v.adet - (dbSayim.get(k) ?? 0)
  for (let i = 0; i < eksik; i++) {
    const r = v.satir
    eklenecekTemaslar.push({
      kisi_id: v.kisiId,
      tarih: seriTarih(r[0]),
      yontem: duz(r[2]),
      ofis_disi_yuz_yuze: String(duz(r[3]) ?? '').toLowerCase().startsWith('evet'),
      not: duz(r[4]),
    })
  }
}

const idAd = new Map<string, string>()
for (const k of kisilerDb!) idAd.set(k.id as string, k.ad as string)
for (const k of cozum.values()) idAd.set(k.id as string, k.ad as string)

for (const t of eklenecekTemaslar) {
  const ad = idAd.get(t.kisi_id as string) ?? String(t.kisi_id)
  const yeniMi = String(t.kisi_id).startsWith('yeni:')
  console.log(
    `  + ${t.tarih}  ${ad.replace(/^yeni:/, '').padEnd(24)} ${String(t.yontem ?? '—').padEnd(10)} ${t.not ?? ''}${yeniMi ? '  (yeni kişiye)' : ''}`,
  )
}
if (eklenecekTemaslar.length === 0) console.log('  (yok)')
if (UYGULA && eklenecekTemaslar.length) {
  const { error } = await db.from('temaslar').insert(eklenecekTemaslar)
  if (error) { console.error(`  ✗ ${error.message}`); process.exit(1) }
}

/* ------------------------------------------------------------------ 5. silme */

console.log('\n── 5. Silinecek deneme kayıtları ─────────────────────────')
for (const ad of SIL) {
  const kayit = dbHarita.get(anahtar(ad))
  if (!kayit) { console.log(`  (${ad} zaten yok)`); continue }
  const { count } = await db
    .from('temaslar')
    .select('*', { count: 'exact', head: true })
    .eq('kisi_id', kayit.id)
  console.log(`  − ${ad.padEnd(18)} (${count ?? 0} temas kaydıyla birlikte)`)
  if (UYGULA) {
    await db.from('temaslar').delete().eq('kisi_id', kayit.id)
    await db.from('degisiklik_gecmisi').delete().eq('kayit_id', kayit.id)
    const { error } = await db.from('kisiler').delete().eq('id', kayit.id)
    if (error) { console.error(`  ✗ ${error.message}`); process.exit(1) }
  }
}

/* ---------------------------------------------------------------- 6. arşiv */

console.log('\n── 6. Arşivlenecekler ────────────────────────────────────')
for (const ad of ARSIVLE) {
  const kayit = dbHarita.get(anahtar(ad))
  if (!kayit) { console.log(`  (${ad} bulunamadı)`); continue }
  if (kayit.arsiv) { console.log(`  (${ad} zaten arşivde)`); continue }
  console.log(`  ⌂ ${ad}`)
  if (UYGULA) {
    const { error } = await db.from('kisiler').update({ arsiv: true }).eq('id', kayit.id)
    if (error) { console.error(`  ✗ ${error.message}`); process.exit(1) }
    audit(kayit.id as string, 'arsiv', 'false', 'true')
  }
}

/* -------------------------------------------------------------- audit yaz */

if (UYGULA && auditKuyrugu.length) {
  const { error } = await db.from('degisiklik_gecmisi').insert(auditKuyrugu)
  if (error) console.error(`  ⚠ Değişiklik geçmişi yazılamadı: ${error.message}`)
}

/* ------------------------------------------------------------------- özet */

console.log('\n── ÖZET ──────────────────────────────────────────────────')
console.log(`  ad güncellemesi   : ${adSayaci}`)
console.log(`  alan güncellemesi : ${alanSayaci}`)
console.log(`  yeni kişi         : ${yeniKisiler.length}`)
console.log(`  yeni temas        : ${eklenecekTemaslar.length}`)
console.log(`  silinecek         : ${SIL.length}`)
console.log(`  arşivlenecek      : ${ARSIVLE.length}`)
if (cozulmeyen) console.log(`  ⚠ kişisi bulunamayan temas: ${cozulmeyen}`)
console.log(`  değişiklik geçmişi kaydı: ${UYGULA ? auditKuyrugu.length : adSayaci + alanSayaci + ARSIVLE.length}`)

if (UYGULA) {
  const { count: k } = await db.from('kisiler').select('*', { count: 'exact', head: true })
  const { count: t } = await db.from('temaslar').select('*', { count: 'exact', head: true })
  console.log(`\n✓ Uygulandı. Şimdi: ${k} kişi, ${t} temas.\n`)
} else {
  console.log('\nUygulamak için sonuna --uygula ekle.\n')
}
