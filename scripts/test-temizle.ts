/**
 * Akış testi sırasında oluşan geçici kayıtları siler.
 *
 *   npm run test:temizle          # ne silineceğini gösterir, SİLMEZ
 *   npm run test:temizle -- --sil # gerçekten siler
 *
 * Yalnızca "ZZTEST" ile başlayan kayıtlara dokunur. Gerçek veriye asla
 * uzanmaması için önek kontrolü sabit ve değiştirilemez.
 */

import { createClient } from '@supabase/supabase-js'

const ONEK = 'ZZTEST'
const SIL = process.argv.includes('--sil')

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anahtar = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !anahtar) {
  console.error('✗ Supabase ortam değişkenleri yok.')
  process.exit(1)
}

const db = createClient(url, anahtar, { auth: { persistSession: false } })

console.log(SIL ? `"${ONEK}" ile başlayan kayıtlar SİLİNECEK\n` : `Kuru çalışma — hiçbir şey silinmeyecek\n`)

const { data: hedefler } = await db
  .from('hedefler')
  .select('id, hedef_isim, tasindi_kisi_id')
  .like('hedef_isim', `${ONEK}%`)

const { data: kisiler } = await db.from('kisiler').select('id, ad').like('ad', `${ONEK}%`)

console.log(`hedefler (${hedefler?.length ?? 0}):`)
for (const h of hedefler ?? []) console.log(`  ${h.id}  ${h.hedef_isim}`)

console.log(`kişiler (${kisiler?.length ?? 0}):`)
for (const k of kisiler ?? []) console.log(`  ${k.id}  ${k.ad}`)

const kisiIdleri = (kisiler ?? []).map((k) => k.id as string)
const testKurumIdleri: string[] = []

if (kisiIdleri.length) {
  const { count } = await db
    .from('temaslar')
    .select('*', { count: 'exact', head: true })
    .in('kisi_id', kisiIdleri)
  console.log(`bu kişilere ait temas kaydı: ${count ?? 0}`)
}

if (!SIL) {
  console.log('\nSilmek için: npm run test:temizle -- --sil')
  process.exit(0)
}

// Sıra önemli: önce bağımlılıklar, sonra kişi.
if (kisiIdleri.length) {
  await db.from('temaslar').delete().in('kisi_id', kisiIdleri)
  // K-04: deneme kişilerinin geçmişi (tablo yoksa hata yok sayılır).
  // Bağlı oldukları kurumları not al: başka kimse kullanmıyorsa aşağıda silinir.
  const { data: testGecmis } = await db.from('kisi_gecmisi').select('kurum_id').in('kisi_id', kisiIdleri)
  testKurumIdleri.push(...(testGecmis ?? []).map((g) => g.kurum_id as string))
  await db.from('kisi_gecmisi').delete().in('kisi_id', kisiIdleri)
  await db.from('degisiklik_gecmisi').delete().in('kayit_id', kisiIdleri)
}
await db.from('hedefler').delete().like('hedef_isim', `${ONEK}%`)
if (kisiIdleri.length) await db.from('kisiler').delete().in('id', kisiIdleri)
// Deneme kişilerinin kullandığı ya da ZZTEST adlı kurumlar; yalnızca artık
// HİÇBİR geçmiş kaydı (arşivliler dahil) onlara bağlı değilse silinir.
const { data: testKurumlar } = await db.from('kurumlar').select('id').like('ad', `${ONEK}%`)
const adayKurumlar = [...new Set([...testKurumIdleri, ...(testKurumlar ?? []).map((k) => k.id as string)])]
for (const k of adayKurumlar.map((id) => ({ id }))) {
  const { count } = await db.from('kisi_gecmisi').select('*', { count: 'exact', head: true }).eq('kurum_id', k.id)
  if (!count) await db.from('kurumlar').delete().eq('id', k.id)
}

const { count: kalanKisi } = await db.from('kisiler').select('*', { count: 'exact', head: true })
const { count: kalanTemas } = await db.from('temaslar').select('*', { count: 'exact', head: true })
const { count: kalanHedef } = await db.from('hedefler').select('*', { count: 'exact', head: true })

console.log(`\n✓ Temizlendi. Kalan → kişi: ${kalanKisi}  temas: ${kalanTemas}  hedef: ${kalanHedef}`)
