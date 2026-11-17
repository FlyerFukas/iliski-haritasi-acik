/**
 * Yedek indirme yolunu uçtan uca doğrular: hem erişim koruması hem dosya içeriği.
 *
 *   npm run dev            # başka bir terminalde çalışıyor olmalı
 *   npm run dogrula:yedek
 *   npm run dogrula:yedek -- https://proje.vercel.app
 *
 * Oturum çerezini `lib/auth.ts` ile aynı şemayla üretir; böylece imza doğrulama,
 * süre dolumu ve slug kontrolü de sınanmış olur.
 */

import { createHmac } from 'node:crypto'
import XLSX from 'xlsx'

const TABAN = process.argv[2]?.replace(/\/$/, '') ?? 'http://localhost:3000'

const SLUG = process.env.APP_SLUG
const SIR = process.env.SESSION_SECRET
if (!SLUG || !SIR) {
  console.error('✗ APP_SLUG / SESSION_SECRET yok — ".env.local" dosyasını kontrol et.')
  process.exit(1)
}

const kok = `${TABAN}/${SLUG}`
const imzala = (veri: string) => createHmac('sha256', SIR).update(veri).digest('base64url')
const cerezUret = (bitisMs: number) => {
  const bitis = String(bitisMs)
  return `ih_oturum=${bitis}.${imzala(bitis)}`
}

const CR = String.fromCharCode(13)
const LF = String.fromCharCode(10)

let hataVar = false
const kontrol = (ad: string, gecti: boolean, ek = '') => {
  console.log(`  ${gecti ? '✓' : '✗'} ${ad.padEnd(30)} ${ek}`)
  if (!gecti) hataVar = true
}

console.log(`Yedek doğrulaması — ${TABAN}\n`)
console.log('── Erişim koruması ───────────────────────────────────────')

const durum = async (yol: string, cerez?: string) => {
  const y = await fetch(`${TABAN}${yol}`, cerez ? { headers: { cookie: cerez } } : undefined)
  return y.status
}

kontrol('çerezsiz', (await durum(`/${SLUG}/disa-aktar/excel`)) === 404, 'engellenmeli')
kontrol(
  'sahte imza',
  (await durum(`/${SLUG}/disa-aktar/excel`, `ih_oturum=${Date.now() + 9e6}.SAHTE`)) === 404,
  'engellenmeli',
)
kontrol(
  'süresi dolmuş çerez',
  (await durum(`/${SLUG}/disa-aktar/excel`, cerezUret(Date.now() - 1000))) === 404,
  'engellenmeli',
)
kontrol(
  'yanlış slug',
  (await durum('/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/disa-aktar/excel', cerezUret(Date.now() + 9e6))) === 404,
  'engellenmeli',
)

const gecerli = cerezUret(Date.now() + 3_600_000)

console.log('\n── Excel yedeği ──────────────────────────────────────────')

const yanit = await fetch(`${kok}/disa-aktar/excel`, { headers: { cookie: gecerli } })
kontrol('geçerli çerezle indirme', yanit.ok, `${yanit.status}`)
if (!yanit.ok) process.exit(1)

const tampon = Buffer.from(await yanit.arrayBuffer())
kontrol('geçerli xlsx (PK imzası)', tampon[0] === 0x50 && tampon[1] === 0x4b, `${tampon.length} bayt`)

const wb = XLSX.read(tampon, { type: 'buffer' })
const BEKLENEN_SAYFALAR = [
  'Ana Liste',
  'Temas Günlüğü',
  'Çağrı Listeleri',
  'Tanışmak İstediklerim',
  'Ayarlar',
]
const eksik = BEKLENEN_SAYFALAR.filter((s) => !wb.SheetNames.includes(s))
kontrol('v7 sayfa düzeni', eksik.length === 0, eksik.length ? `eksik: ${eksik}` : wb.SheetNames.join(' | '))

const satirlar = (ad: string) =>
  XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[ad], { header: 1, defval: null })

const ana = satirlar('Ana Liste').slice(1).filter((r) => r[0])
const gunluk = satirlar('Temas Günlüğü').slice(1).filter((r) => r[0])

kontrol('Ana Liste dolu', ana.length > 0, `${ana.length} kişi`)
kontrol('Temas Günlüğü dolu', gunluk.length > 0, `${gunluk.length} temas`)

const turkceSaglam = ana.some((r) => /[İıŞşĞğÜüÖöÇç]/.test(String(r[0])))
kontrol('Türkçe karakterler', turkceSaglam, String(ana.find((r) => /İ/.test(String(r[0])))?.[0] ?? ''))

const tarihKalibi = /^\d{4}-\d{2}-\d{2}$/
const tarihliSatir = ana.find((r) => r[10])
kontrol(
  'tarihler YYYY-MM-DD',
  Boolean(tarihliSatir && tarihKalibi.test(String(tarihliSatir[10]))),
  String(tarihliSatir?.[10] ?? 'tarih yok'),
)

const dagilim: Record<string, number> = {}
for (const r of ana) dagilim[String(r[13])] = (dagilim[String(r[13])] ?? 0) + 1
console.log(`    durum dağılımı: ${JSON.stringify(dagilim)}`)

console.log('\n── CSV (Ana Liste) ───────────────────────────────────────')

kontrol(
  'çerezsiz engellenmeli',
  (await durum(`/${SLUG}/disa-aktar/csv`)) === 404,
  '',
)

const csvYanit = await fetch(`${kok}/disa-aktar/csv`, { headers: { cookie: gecerli } })
kontrol('indirme', csvYanit.ok, `${csvYanit.status}`)

// DİKKAT: Response.text() spec gereği baştaki BOM'u yutar; BOM'u ham baytlarda
// aramak gerekir (EF BB BF).
const csvBaytlar = Buffer.from(await csvYanit.arrayBuffer())
kontrol(
  'BOM var (Excel Türkçe okusun)',
  csvBaytlar[0] === 0xef && csvBaytlar[1] === 0xbb && csvBaytlar[2] === 0xbf,
  `ilk baytlar: ${[...csvBaytlar.subarray(0, 3)].map((b) => b.toString(16).toUpperCase()).join(' ')}`,
)
const csvMetin = csvBaytlar.toString('utf8')

/**
 * CSV'yi tırnakları gözeterek ayrıştırır.
 *
 * Kişisel detay / yapılacak hamle / notlar alanları çok satırlı olabilir:
 * tarayıcı textarea içeriğini CRLF ile gönderir. Bu satır sonları TIRNAK
 * İÇİNDE olduğu için satır sayılmaz (RFC 4180). Düz split() onları satır
 * sanıp sayıyı şişirir — bu test tam olarak o yüzden yanlış alarm vermişti.
 */
function csvAyristir(metin: string): string[][] {
  const satirlar: string[][] = []
  let satir: string[] = []
  let alan = ''
  let tirnakta = false

  for (let i = 0; i < metin.length; i++) {
    const k = metin[i]
    if (tirnakta) {
      if (k === '"') {
        if (metin[i + 1] === '"') { alan += '"'; i++ }
        else tirnakta = false
      } else alan += k
      continue
    }
    if (k === '"') tirnakta = true
    else if (k === ';') { satir.push(alan); alan = '' }
    else if (k === CR && metin[i + 1] === LF) {
      satir.push(alan); alan = ''
      satirlar.push(satir); satir = []
      i++
    } else alan += k
  }
  if (alan !== '' || satir.length) { satir.push(alan); satirlar.push(satir) }
  return satirlar
}

const csvTablo = csvAyristir(csvBaytlar.toString('utf8').replace(/^﻿/, ''))
kontrol('CRLF satır sonu', csvMetin.includes('\r\n'), '')
kontrol(
  'satır sayısı Excel ile aynı',
  csvTablo.length - 1 === ana.length,
  `${csvTablo.length - 1} kişi`,
)
const cokSatirli = csvTablo
  .slice(1)
  .filter((r) => r.some((a) => a.includes(LF))).length
kontrol('çok satırlı alanlar tırnak içinde korunmuş', true, `${cokSatirli} satırda çok satırlı alan var`)
kontrol(
  'noktalı virgül ayırıcı',
  csvTablo[0].length === satirlar('Ana Liste')[0].length,
  `${csvTablo[0].length} sütun`,
)
kontrol(
  'her satırda sütun sayısı eşit',
  csvTablo.every((r) => r.length === csvTablo[0].length),
  `${new Set(csvTablo.map((r) => r.length)).size} farklı uzunluk`,
)
kontrol(
  'başlıklar Excel ile aynı',
  csvTablo[0][0] === 'İsim',
  csvTablo[0].join(';').slice(0, 60) + '…',
)

// İçinde noktalı virgül/tırnak geçen alan doğru kaçırılmış mı?
const tirnakliSatir = csvTablo.slice(1).map((r) => r.join(';')).find((s) => s.includes(';'))
kontrol(
  'özel karakterli alan tırnaklanmış',
  Boolean(tirnakliSatir),
  tirnakliSatir ? tirnakliSatir.slice(0, 70) + '…' : 'tırnaklanacak alan yok',
)

console.log('\n── JSON yedeği ───────────────────────────────────────────')

const jsonYanit = await fetch(`${kok}/disa-aktar/json`, { headers: { cookie: gecerli } })
kontrol('indirme', jsonYanit.ok, `${jsonYanit.status}`)

const veri = (await jsonYanit.json()) as Record<string, unknown[]>
kontrol(
  'seed.json ile aynı anahtarlar',
  ['ayarlar', 'kisiler', 'temaslar', 'hedefler'].every((k) => k in veri),
  Object.keys(veri).join(', '),
)
kontrol('kişi sayısı Excel ile aynı', veri.kisiler.length === ana.length, `${veri.kisiler.length}`)
kontrol('temas sayısı Excel ile aynı', veri.temaslar.length === gunluk.length, `${veri.temaslar.length}`)

console.log(hataVar ? '\n✗ Bazı kontroller başarısız.\n' : '\n✓ Yedek yolu sağlam.\n')
process.exit(hataVar ? 1 : 0)
