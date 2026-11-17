/**
 * Bir Excel dosyasını canlı veritabanıyla karşılaştırır. HİÇBİR ŞEY YAZMAZ.
 *
 *   npm run excel:fark -- "C:/Users/furka/Documents/Iliski_Haritasi_Ferrazzi_v7.xlsx"
 *
 * Amaç: Excel'de elle yapılan güncellemeleri uygulamaya taşımadan ÖNCE
 * tam olarak neyin değişeceğini görmek. Kör senkron veri kaybettirir.
 */

import { createClient } from '@supabase/supabase-js'
import XLSX from 'xlsx'
import { anahtar } from '../lib/turkce.ts'

const DOSYA = process.argv[2]
if (!DOSYA) {
  console.error('✗ Excel yolu ver: npm run excel:fark -- "<yol>"')
  process.exit(1)
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const gizli = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !gizli) {
  console.error('✗ Supabase ortam değişkenleri yok.')
  process.exit(1)
}
const db = createClient(url, gizli, { auth: { persistSession: false } })

/* --------------------------------------------------------------- kolonlar */

// Ana Liste kolon indeksleri → veritabanı alanları
const ESLEME: Array<[number, string]> = [
  [1, 'halka'],
  [2, 'kategori'],
  [3, 'frekans'],
  [4, 'rol'],
  [5, 'sirket'],
  [6, 'sektor'],
  [7, 'sehir'],
  [8, 'telefon'],
  [9, 'eposta'],
  [19, 'kisisel_detay'],
  [20, 'yapilacak_hamle'],
  [21, 'profil_baglantisi'],
  [22, 'notlar'],
  [23, 'ozel_aralik_gun'],
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

/* ------------------------------------------------------------------- oku */

const wb = XLSX.readFile(DOSYA)
const satirlar = XLSX.utils
  .sheet_to_json<unknown[]>(wb.Sheets['Ana Liste'], { header: 1, defval: null })
  .slice(1)
  .filter((r) => duz(r[0]))

const temasSatirlari = XLSX.utils
  .sheet_to_json<unknown[]>(wb.Sheets['Temas Günlüğü'], { header: 1, defval: null })
  .slice(1)
  .filter((r) => r[0] && duz(r[1]))

const { data: kisilerDb, error } = await db.from('kisiler').select('*')
if (error) {
  console.error(`✗ Kişiler okunamadı: ${error.message}`)
  process.exit(1)
}
const { data: temaslarDb } = await db.from('temaslar').select('kisi_id, tarih, yontem, not')

const dbHarita = new Map((kisilerDb ?? []).map((k) => [anahtar(k.ad as string), k]))
const dbIdAd = new Map((kisilerDb ?? []).map((k) => [k.id as string, k.ad as string]))

console.log(`Excel  : ${DOSYA}`)
console.log(`Kişi   : Excel ${satirlar.length}  ↔  uygulama ${kisilerDb?.length ?? 0}`)
console.log(`Temas  : Excel ${temasSatirlari.length}  ↔  uygulama ${temaslarDb?.length ?? 0}`)

/* ----------------------------------------------------------- yeni kişiler */

const yeniler = satirlar.filter((r) => !dbHarita.has(anahtar(String(r[0]))))

console.log(`\n── Uygulamada OLMAYAN kişiler (${yeniler.length}) ────────────────`)
for (const r of yeniler) {
  const dolu = ESLEME.filter(([i]) => duz(r[i])).length
  console.log(`  + ${String(r[0]).padEnd(24)} ${r[1] ?? '—'} / ${r[3] ?? '—'}  (${dolu} alan dolu)`)
}

/* -------------------------------------------------- alan farkları (mevcut) */

interface Fark {
  ad: string
  alan: string
  uygulama: string | null
  excel: string | null
}
const farklar: Fark[] = []
const excelBos: Fark[] = []

for (const r of satirlar) {
  const mevcut = dbHarita.get(anahtar(String(r[0])))
  if (!mevcut) continue

  for (const [idx, alan] of ESLEME) {
    const e = duz(r[idx])
    const u = duz((mevcut as Record<string, unknown>)[alan])
    if (e === u) continue
    if (SAYISAL.has(alan) && Number(e) === Number(u)) continue

    const kayit = { ad: String(r[0]), alan, uygulama: u, excel: e }
    // Excel'de boş ama uygulamada dolu → Excel eski olabilir, ayrı raporla
    if (e === null && u !== null) excelBos.push(kayit)
    else farklar.push(kayit)
  }
}

const kisalt = (s: string | null, n = 42) =>
  s === null ? '(boş)' : s.length > n ? s.slice(0, n) + '…' : s

console.log(`\n── Excel'de DOLU, uygulamada farklı/eksik (${farklar.length}) ──────`)
for (const f of farklar) {
  console.log(`  ${f.ad.padEnd(20)} ${f.alan.padEnd(18)}`)
  console.log(`      uygulama: ${kisalt(f.uygulama)}`)
  console.log(`      excel   : ${kisalt(f.excel)}`)
}

console.log(`\n── Uygulamada DOLU, Excel'de boş (${excelBos.length}) ─────────────`)
console.log('   (bunlara DOKUNULMAYACAK — uygulama daha güncel olabilir)')
for (const f of excelBos) {
  console.log(`  ${f.ad.padEnd(20)} ${f.alan.padEnd(18)} uygulama: ${kisalt(f.uygulama, 30)}`)
}

/* ------------------------------------------------------------- temaslar */

const temasImza = (kisiAd: string, tarih: string, yontem: string | null, not: string | null) =>
  [anahtar(kisiAd), tarih, yontem ?? '', (not ?? '').trim()].join('␟')

const mevcutTemasImzalari = new Set(
  (temaslarDb ?? []).map((t) =>
    temasImza(
      dbIdAd.get(t.kisi_id as string) ?? '',
      t.tarih as string,
      t.yontem as string | null,
      t.not as string | null,
    ),
  ),
)

const yeniTemaslar = temasSatirlari.filter((r) => {
  const imza = temasImza(String(r[1]), seriTarih(r[0]) ?? '', duz(r[2]), duz(r[4]))
  return !mevcutTemasImzalari.has(imza)
})

console.log(`\n── Uygulamada OLMAYAN temaslar (${yeniTemaslar.length}) ───────────`)
for (const r of yeniTemaslar) {
  const kisiVar = dbHarita.has(anahtar(String(r[1]))) || yeniler.some((y) => anahtar(String(y[0])) === anahtar(String(r[1])))
  console.log(
    `  + ${seriTarih(r[0])}  ${String(r[1]).padEnd(22)} ${String(duz(r[2]) ?? '—').padEnd(12)} ${duz(r[4]) ?? ''}${kisiVar ? '' : '   ⚠ KİŞİ YOK'}`,
  )
}

console.log(`\n── ÖZET ──────────────────────────────────────────────────`)
console.log(`  eklenecek kişi   : ${yeniler.length}`)
console.log(`  güncellenecek alan: ${farklar.length}`)
console.log(`  eklenecek temas  : ${yeniTemaslar.length}`)
console.log(`  dokunulmayacak   : ${excelBos.length} alan (Excel'de boş)`)
console.log('\n(Bu script hiçbir şey yazmadı.)\n')
