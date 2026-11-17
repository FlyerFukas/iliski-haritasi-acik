/**
 * JSON yedeği gerçekten geri yüklenebiliyor mu?
 *
 *   npm run dogrula:turatma
 *
 * Veritabanına DOKUNMAZ. Canlı JSON yedeğini indirir ve `scripts/seed.ts`'in
 * okuduğu alanlarla karşılaştırır: yedekteki her alan seed tarafından geri
 * yazılabiliyor mu, yoksa sessizce düşen alan var mı?
 *
 * Bu test olmadan "yedek alabiliyorsun" demek yanıltıcı olur — dosyanın
 * üretilmesi geri yüklenebildiği anlamına gelmez.
 */

import { createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const KOK = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const TABAN = process.argv[2]?.replace(/\/$/, '') ?? 'http://localhost:3000'

const SLUG = process.env.APP_SLUG
const SIR = process.env.SESSION_SECRET
if (!SLUG || !SIR) {
  console.error('✗ APP_SLUG / SESSION_SECRET yok.')
  process.exit(1)
}

const bitis = String(Date.now() + 3_600_000)
const cerez = `ih_oturum=${bitis}.${createHmac('sha256', SIR).update(bitis).digest('base64url')}`

let hataVar = false
const kontrol = (ad: string, gecti: boolean, ek = '') => {
  console.log(`  ${gecti ? '✓' : '✗'} ${ad.padEnd(42)} ${ek}`)
  if (!gecti) hataVar = true
}

console.log(`JSON yedeği geri yüklenebilir mi? — ${TABAN}\n`)

const yanit = await fetch(`${TABAN}/${SLUG}/disa-aktar/json`, { headers: { cookie: cerez } })
if (!yanit.ok) {
  console.error(`✗ Yedek indirilemedi: ${yanit.status}`)
  process.exit(1)
}
const yedek = (await yanit.json()) as {
  ayarlar: { frekans_gun: Record<string, number> }
  kisiler: Array<Record<string, unknown>>
  temaslar: Array<Record<string, unknown>>
  hedefler: Array<Record<string, unknown>>
}

// seed.ts'in gerçekten veritabanına yazdığı alanları kaynaktan çıkar.
const seedKaynak = readFileSync(resolve(KOK, 'scripts/seed.ts'), 'utf8')

const bloktakiAlanlar = (baslangic: string, bitisIsareti: string): string[] => {
  const b = seedKaynak.indexOf(baslangic)
  if (b < 0) return []
  const s = seedKaynak.slice(b, seedKaynak.indexOf(bitisIsareti, b))
  // Girinti bloktan bloğa değişiyor (nesne literali 4, push(...) içi 6 boşluk),
  // bu yüzden aralık veriyoruz.
  return [...s.matchAll(/^ {4,8}(\w+):/gm)].map((m) => m[1])
}

const seedKisiAlanlari = bloktakiAlanlar('const satirlar = kisiler.map', '}))')
const seedTemasAlanlari = bloktakiAlanlar('eklenecek.push({', '})')

console.log('── Yapı ──────────────────────────────────────────────────')
kontrol('yedek boş değil', yedek.kisiler.length > 0, `${yedek.kisiler.length} kişi`)
kontrol(
  'seed.ts kişi alanlarını buldu',
  seedKisiAlanlari.length > 5,
  seedKisiAlanlari.join(', '),
)
kontrol(
  'seed.ts temas alanlarını buldu',
  seedTemasAlanlari.length > 3,
  seedTemasAlanlari.join(', '),
)

console.log('\n── Kişi alanları ─────────────────────────────────────────')
const yedekKisiAlanlari = Object.keys(yedek.kisiler[0] ?? {})
const dusenKisi = yedekKisiAlanlari.filter((a) => !seedKisiAlanlari.includes(a))
kontrol(
  'yedekteki her alan geri yükleniyor',
  dusenKisi.length === 0,
  dusenKisi.length ? `DÜŞEN: ${dusenKisi.join(', ')}` : `${yedekKisiAlanlari.length} alan`,
)

console.log('\n── Temas alanları ────────────────────────────────────────')
const yedekTemasAlanlari = Object.keys(yedek.temaslar[0] ?? {})
// 'kisi' isim alanı; seed onu kisi_id'ye çevirir, birebir eşleşmesi beklenmez.
const dusenTemas = yedekTemasAlanlari.filter(
  (a) => a !== 'kisi' && !seedTemasAlanlari.includes(a),
)
kontrol(
  'yedekteki her alan geri yükleniyor',
  dusenTemas.length === 0,
  dusenTemas.length ? `DÜŞEN: ${dusenTemas.join(', ')}` : `${yedekTemasAlanlari.length} alan`,
)
kontrol(
  'kişi adı → id çözümlemesi mümkün',
  yedek.temaslar.every((t) => typeof t.kisi === 'string' && t.kisi),
  'her temasın kişi adı dolu',
)

console.log('\n── Kritik bayraklar ──────────────────────────────────────')
kontrol('kişilerde arsiv alanı var', 'arsiv' in (yedek.kisiler[0] ?? {}), 'arşiv durumu korunur')
kontrol('temaslarda iptal alanı var', 'iptal' in (yedek.temaslar[0] ?? {}), 'iptal işareti korunur')
kontrol('seed arsiv yazıyor', seedKisiAlanlari.includes('arsiv'), '')
kontrol('seed iptal yazıyor', seedTemasAlanlari.includes('iptal'), '')

console.log('\n── Ayarlar ───────────────────────────────────────────────')
kontrol(
  'frekans_gun biçimi seed ile uyumlu',
  ['1', '2', '3'].every((k) => typeof yedek.ayarlar?.frekans_gun?.[k] === 'number'),
  JSON.stringify(yedek.ayarlar?.frekans_gun),
)

console.log(
  hataVar
    ? '\n✗ Yedek TAM geri yüklenemez — yukarıdaki alanlar kaybolur.\n'
    : '\n✓ Yedekteki her alan seed tarafından geri yazılıyor.\n',
)
process.exit(hataVar ? 1 : 0)
