import { createHmac, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'

/**
 * Erişim denetimi (SPEC §6): gizli slug + tek parola.
 *
 * Kasıtlı olarak basit — kullanıcı hesabı, rol, oturum tablosu yok (CLAUDE.md).
 * Çerez imzalıdır; içeriği yalnızca "şu ana kadar geçerli" bilgisidir, sunucuda
 * durum tutulmaz.
 */

const CEREZ_ADI = 'ih_oturum'
const GECERLILIK_GUN = 30

function ortam(ad: string): string {
  const deger = process.env[ad]
  if (!deger) {
    throw new Error(`Ortam değişkeni eksik: ${ad}. ".env.local" dosyasını doldur.`)
  }
  return deger
}

/** Uzunluk farkını da sızdırmayan karşılaştırma. */
function esitMi(a: string, b: string): boolean {
  const x = Buffer.from(createHmac('sha256', 'kiyas').update(a).digest())
  const y = Buffer.from(createHmac('sha256', 'kiyas').update(b).digest())
  return timingSafeEqual(x, y)
}

function imzala(veri: string): string {
  return createHmac('sha256', ortam('SESSION_SECRET')).update(veri).digest('base64url')
}

/* ------------------------------------------------------------------ slug */

/** Adresteki slug doğru mu. Yanlışsa çağıran taraf 404 vermeli — asla "yanlış slug" deme. */
export function slugGecerli(slug: string): boolean {
  return esitMi(slug, ortam('APP_SLUG'))
}

export function slug(): string {
  return ortam('APP_SLUG')
}

/* ---------------------------------------------------------------- parola */

export function parolaDogru(girilen: string): boolean {
  return esitMi(girilen, ortam('APP_PASSWORD'))
}

/* ---------------------------------------------------------------- oturum */

/** Çerez değeri: "<bitişZamanı>.<imza>" */
function cerezUret(): string {
  const bitis = String(Date.now() + GECERLILIK_GUN * 86_400_000)
  return `${bitis}.${imzala(bitis)}`
}

function cerezGecerli(deger: string | undefined): boolean {
  if (!deger) return false
  const nokta = deger.lastIndexOf('.')
  if (nokta <= 0) return false

  const bitis = deger.slice(0, nokta)
  const imza = deger.slice(nokta + 1)

  if (!esitMi(imza, imzala(bitis))) return false // kurcalanmış
  const zaman = Number(bitis)
  return Number.isFinite(zaman) && zaman > Date.now() // süresi dolmuş mu
}

export async function oturumAc(): Promise<void> {
  const kavanoz = await cookies()
  kavanoz.set(CEREZ_ADI, cerezUret(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: GECERLILIK_GUN * 86_400,
  })
}

export async function oturumKapat(): Promise<void> {
  const kavanoz = await cookies()
  kavanoz.delete(CEREZ_ADI)
}

export async function oturumVar(): Promise<boolean> {
  const kavanoz = await cookies()
  return cerezGecerli(kavanoz.get(CEREZ_ADI)?.value)
}

/**
 * Her server action'ın İLK satırı bu olmalı.
 *
 * Sayfa düzeni (layout) korumasına güvenmek yetmez: server action'lar
 * layout'tan geçmeden doğrudan çağrılabilir. Yazma yapan her yol kendi
 * kontrolünü yapar.
 */
export async function oturumZorunlu(): Promise<void> {
  if (!(await oturumVar())) {
    throw new Error('Oturum yok veya süresi dolmuş. Sayfayı yenileyip tekrar gir.')
  }
}
