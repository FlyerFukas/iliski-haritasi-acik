import { slugGecerli } from '@/lib/auth'

/**
 * PWA manifesti — Chrome'daki "uygulama olarak yükle" seçeneği bunu ister.
 *
 * DİKKAT: Manifest gizli slug'ın ALTINDA duruyor, kökte değil. Kökte olsaydı
 * içindeki start_url gizli adresi herkese açık ederdi ve gizli-URL korumasının
 * tamamı anlamsızlaşırdı. Route handler layout'lardan geçmediği için slug
 * kontrolünü burada kendimiz yapıyoruz.
 */
export async function GET(
  _istek: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  if (!slugGecerli(slug)) {
    return new Response('Sayfa bulunamadı.', { status: 404 })
  }

  const manifest = {
    // Sabit kimlik: slug değişse bile Chrome uygulamayı aynı uygulama sayar
    id: '/iliski-haritasi',
    name: 'İlişki Haritası',
    short_name: 'İlişki',
    description: 'Kişisel network takip sistemi',
    lang: 'tr',
    dir: 'ltr',
    start_url: `/${slug}`,
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0f1216',
    theme_color: '#0f1216',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Temas ekle', short_name: 'Temas', url: `/${slug}/temas` },
      { name: 'Kişiler', short_name: 'Kişiler', url: `/${slug}/kisiler` },
    ],
  }

  return Response.json(manifest, {
    headers: {
      'Content-Type': 'application/manifest+json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}
