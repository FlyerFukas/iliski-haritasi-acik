/**
 * lib/hesaplama.ts çıktısını kaynak Excel'in (v7) hesaplanmış kolonlarıyla karşılaştırır.
 *
 *   npm run dogrula
 *   npm run dogrula -- --bugun 2026-07-31
 *
 * Amaç: SPEC §9 kabul kriteri — "Excel'deki değerlerle birebir aynı".
 * Supabase'e ihtiyaç duymaz; seed.json + xlsx üzerinden çalışır.
 */

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import XLSX from 'xlsx'
import { anahtar } from '../lib/turkce.ts'
import {
  VARSAYILAN_AYARLAR,
  kisiOzet,
  type Ayarlar,
  type Durum,
  type Kisi,
  type Temas,
  type Yontem,
} from '../lib/hesaplama.ts'

const BURASI = dirname(fileURLToPath(import.meta.url))
const KOK = resolve(BURASI, '..')

/* -------------------------------------------------------------- yardımcı */

/** Excel seri numarası → 'YYYY-MM-DD'. Excel'in epoch'u 1899-12-30. */
function seriTarih(seri: unknown): string | null {
  if (typeof seri !== 'number') return null
  return new Date(Date.UTC(1899, 11, 30) + seri * 86_400_000).toISOString().slice(0, 10)
}

const DURUM_ESLEME: Record<string, Durum> = {
  'GECİKTİ': 'GECIKTI',
  'YAKLAŞIYOR': 'YAKLASIYOR',
  'GÜNCEL': 'GUNCEL',
  '⚠ KAYIT YOK': 'KAYIT_YOK',
}

// Ana Liste kolon indeksleri (v7)
const K = {
  isim: 0,
  frekans: 3,
  sonTemas: 10,
  sonYontem: 11,
  sonraki: 12,
  durum: 13,
  temasSayisi: 14,
  yontemCesidi: 15,
  ucTemas: 16,
  yuzYuze: 17,
  arkadas: 18,
  ozelAralik: 23,
} as const

/* ------------------------------------------------------------------ ana */

const argv = process.argv.slice(2)
const bugunBayrak = argv.indexOf('--bugun')

const wb = XLSX.readFile(resolve(KOK, 'Iliski_Haritasi_Ferrazzi_v7.xlsx'))

// Excel'in "Ayarlar" sayfasındaki tarih listesi bugünden başlar; formüllerin
// hangi güne göre hesaplandığını buradan öğreniyoruz.
const ayarSatirlari = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets['Ayarlar'], {
  header: 1,
  defval: null,
})
const excelBugun = seriTarih(ayarSatirlari[1]?.[0])
const BUGUN = bugunBayrak >= 0 ? argv[bugunBayrak + 1] : (excelBugun ?? '')

if (!BUGUN) {
  console.error('✗ Karşılaştırma günü belirlenemedi. --bugun YYYY-MM-DD ver.')
  process.exit(1)
}

// Excel'in frekans gün sayıları
const ayarlar: Ayarlar = { ...VARSAYILAN_AYARLAR }
for (const satir of ayarSatirlari) {
  const etiket = satir?.[2]
  const deger = satir?.[3]
  if (typeof deger !== 'number') continue
  if (etiket === 'Frekans 1') ayarlar.frekans_1_gun = deger
  if (etiket === 'Frekans 2') ayarlar.frekans_2_gun = deger
  if (etiket === 'Frekans 3') ayarlar.frekans_3_gun = deger
}

const seed = JSON.parse(readFileSync(resolve(KOK, 'data/seed.json'), 'utf8'))

console.log('hesaplama.ts ↔ Excel v7 karşılaştırması')
console.log(`  karşılaştırma günü : ${BUGUN}${bugunBayrak < 0 ? ' (Excel\'den okundu)' : ''}`)
console.log(`  frekans günleri    : ${ayarlar.frekans_1_gun} / ${ayarlar.frekans_2_gun} / ${ayarlar.frekans_3_gun}`)

// seed.json'daki temasları kişi adına göre grupla
const temaslarKisiye = new Map<string, Temas[]>()
for (const t of seed.temaslar as Array<Record<string, unknown>>) {
  const a = anahtar(t.kisi as string)
  const liste = temaslarKisiye.get(a) ?? []
  liste.push({
    id: `${a}-${liste.length}`,
    kisi_id: a,
    tarih: t.tarih as string,
    yontem: (t.yontem ?? null) as Yontem | null,
    ofis_disi_yuz_yuze: Boolean(t.ofis_disi_yuz_yuze),
    not: (t.not ?? null) as string | null,
    iptal: false,
  })
  temaslarKisiye.set(a, liste)
}

const excelSatirlar = XLSX.utils
  .sheet_to_json<unknown[]>(wb.Sheets['Ana Liste'], { header: 1, defval: null })
  .slice(1)
  .filter((r) => r[K.isim])

const excelKisiye = new Map<string, unknown[]>()
for (const r of excelSatirlar) excelKisiye.set(anahtar(r[K.isim] as string), r)

interface Uyusmazlik {
  ad: string
  alan: string
  benim: string
  excel: string
}

const uyusmazliklar: Uyusmazlik[] = []
let karsilastirilan = 0

for (const sk of seed.kisiler as Array<Record<string, unknown>>) {
  const a = anahtar(sk.ad as string)
  const excel = excelKisiye.get(a)
  if (!excel) {
    uyusmazliklar.push({ ad: sk.ad as string, alan: 'kayıt', benim: 'var', excel: 'YOK' })
    continue
  }
  karsilastirilan++

  const kisi = { ...sk, id: a, arsiv: false } as unknown as Kisi
  const ozet = kisiOzet(kisi, temaslarKisiye.get(a) ?? [], ayarlar, BUGUN)

  // Excel boş hücreyi kimi yerde null, kimi yerde "" olarak tutar; ikisi de "yok" demek.
  const yaz = (deger: unknown) =>
    deger === null || deger === undefined || deger === '' ? '—' : String(deger)

  const bekle = (alan: string, benim: unknown, excelDeger: unknown) => {
    const b = yaz(benim)
    const e = yaz(excelDeger)
    if (b !== e) uyusmazliklar.push({ ad: sk.ad as string, alan, benim: b, excel: e })
  }

  bekle('son temas', ozet.sonTemasTarihi, seriTarih(excel[K.sonTemas]))
  bekle('son yöntem', ozet.sonTemasYontemi, excel[K.sonYontem])
  bekle('sonraki temas', ozet.sonrakiTemas, seriTarih(excel[K.sonraki]))
  bekle('durum', ozet.durum, DURUM_ESLEME[excel[K.durum] as string] ?? excel[K.durum])
  bekle('temas sayısı', ozet.temasSayisi, excel[K.temasSayisi] ?? 0)
  bekle('yöntem çeşidi', ozet.yontemCesidi, excel[K.yontemCesidi] ?? 0)
  bekle('yüz yüze', ozet.yuzYuzeSayisi, excel[K.yuzYuze] ?? 0)
  bekle('3 yöntem', ozet.ucYontemTamam ? '✓' : '—', excel[K.ucTemas] === '—' ? '—' : '✓')
  bekle('arkadaş yolu', ozet.arkadasYolu ? '✓' : '—', excel[K.arkadas] === '—' ? '—' : '✓')
}

/* ----------------------------------------------------------------- rapor */

console.log(`\n  karşılaştırılan kişi : ${karsilastirilan} / ${excelSatirlar.length}`)

// durum dağılımı karşılaştırması
const benimDagilim = new Map<string, number>()
for (const sk of seed.kisiler as Array<Record<string, unknown>>) {
  const a = anahtar(sk.ad as string)
  const ozet = kisiOzet(
    { ...sk, id: a, arsiv: false } as unknown as Kisi,
    temaslarKisiye.get(a) ?? [],
    ayarlar,
    BUGUN,
  )
  benimDagilim.set(ozet.durum, (benimDagilim.get(ozet.durum) ?? 0) + 1)
}
const excelDagilim = new Map<string, number>()
for (const r of excelSatirlar) {
  const d = DURUM_ESLEME[r[K.durum] as string] ?? 'BİLİNMİYOR'
  excelDagilim.set(d, (excelDagilim.get(d) ?? 0) + 1)
}

console.log('\n  durum dağılımı        benim   excel')
for (const durum of ['GECIKTI', 'YAKLASIYOR', 'GUNCEL', 'KAYIT_YOK']) {
  const b = benimDagilim.get(durum) ?? 0
  const e = excelDagilim.get(durum) ?? 0
  console.log(`    ${durum.padEnd(18)} ${String(b).padStart(5)}   ${String(e).padStart(5)}  ${b === e ? '✓' : '✗'}`)
}

if (uyusmazliklar.length === 0) {
  console.log('\n✓ Tam uyum. hesaplama.ts, Excel v7 ile birebir aynı sonucu veriyor.\n')
} else {
  console.log(`\n✗ ${uyusmazliklar.length} uyuşmazlık:\n`)
  for (const u of uyusmazliklar.slice(0, 40)) {
    console.log(`    ${u.ad.padEnd(22)} ${u.alan.padEnd(14)} benim=${u.benim.padEnd(12)} excel=${u.excel}`)
  }
  if (uyusmazliklar.length > 40) console.log(`    … ve ${uyusmazliklar.length - 40} tane daha`)
  console.log('')
  process.exit(1)
}
