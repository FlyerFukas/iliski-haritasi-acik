import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Supabase istemcisi — YALNIZCA SUNUCU TARAFI.
 *
 * service_role anahtarı RLS'i atlar, bu yüzden bu modül asla bir istemci
 * bileşenine (`'use client'`) import edilmemeli. Tüm veri okuma/yazma
 * server action veya route handler üzerinden geçer (SPEC §6).
 */

let onbellek: SupabaseClient | null = null

function zorunlu(ad: string): string {
  const deger = process.env[ad]
  if (!deger) {
    throw new Error(
      `Ortam değişkeni eksik: ${ad}. ".env.local" dosyasını ".env.local.example" örneğine göre doldur.`,
    )
  }
  return deger
}

export function supabaseSunucu(): SupabaseClient {
  if (onbellek) return onbellek

  onbellek = createClient(
    zorunlu('NEXT_PUBLIC_SUPABASE_URL'),
    zorunlu('SUPABASE_SERVICE_ROLE_KEY'),
    {
      auth: { persistSession: false, autoRefreshToken: false },
      db: { schema: 'public' },
    },
  )

  return onbellek
}
