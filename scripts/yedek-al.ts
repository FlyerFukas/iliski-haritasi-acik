/**
 * Ham tam yedek: her tablonun TÜM satırlarını, tüm sütunlarıyla (id dahil)
 * yedek/ altına tek JSON olarak yazar. Yalnızca okur, hiçbir şey yazmaz/silmez.
 *
 *   npm run yedek
 */
import { createClient } from '@supabase/supabase-js'
import { mkdirSync, writeFileSync } from 'node:fs'

const TABLOLAR = ['kisiler', 'temaslar', 'hedefler', 'ayarlar', 'degisiklik_gecmisi']
// 0004 migration ile gelen tablolar: henüz yoksa atlanır, yedek yine alınır
const ISTEGE_BAGLI = new Set(['kurumlar', 'kisi_gecmisi'])
TABLOLAR.push(...ISTEGE_BAGLI)
const SAYFA = 1000

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anahtar = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !anahtar) {
  console.error('Ortam değişkeni eksik: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
const db = createClient(url, anahtar, { auth: { persistSession: false } })

const yedek: Record<string, unknown[]> = {}
for (const tablo of TABLOLAR) {
  const satirlar: unknown[] = []
  for (let bas = 0; ; bas += SAYFA) {
    const { data, error } = await db.from(tablo).select('*').range(bas, bas + SAYFA - 1)
    if (error && ISTEGE_BAGLI.has(tablo) && /does not exist|could not find the table/i.test(error.message)) {
      console.log(`${tablo}: tablo henüz yok, atlandı`)
      break
    }
    if (error) {
      console.error(`${tablo} okunamadı: ${error.message}`)
      process.exit(1)
    }
    satirlar.push(...(data ?? []))
    if ((data ?? []).length < SAYFA) break
  }
  yedek[tablo] = satirlar
  console.log(`${tablo}: ${satirlar.length} satır`)
}

const zaman = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
mkdirSync('yedek', { recursive: true })
const yol = `yedek/tam-yedek-${zaman}.json`
writeFileSync(yol, JSON.stringify({ alindi: new Date().toISOString(), tablolar: yedek }, null, 2))
console.log(`Yazıldı: ${yol}`)
