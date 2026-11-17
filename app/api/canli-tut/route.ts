import { supabaseSunucu } from '@/lib/supabase'

/**
 * K-00: Supabase ücretsiz planı 7 gün istek almayan projeyi uyutur.
 * Vercel cron bu rotayı günde bir çağırır; tek satırlık bir OKUMA yapar,
 * hiçbir şey yazmaz. Vercel, CRON_SECRET tanımlıysa onu
 * `Authorization: Bearer ...` başlığıyla gönderir. Anahtarsız çağrı 404 alır.
 */
export const dynamic = 'force-dynamic'

export async function GET(istek: Request) {
  const gizli = process.env.CRON_SECRET
  if (!gizli || istek.headers.get('authorization') !== `Bearer ${gizli}`) {
    return new Response('Bulunamadı', { status: 404 })
  }

  const { error } = await supabaseSunucu().from('ayarlar').select('tek_satir').limit(1)
  if (error) {
    return Response.json({ tamam: false, hata: error.message }, { status: 500 })
  }
  return Response.json({ tamam: true, zaman: new Date().toISOString() })
}
