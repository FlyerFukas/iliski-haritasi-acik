import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { slugGecerli } from '@/lib/auth'
import ServiceWorkerKaydi from './ServiceWorkerKaydi'

/**
 * Manifest bağlantısı gizli slug'ın altını gösterir — kökte durursa adres
 * herkese açılırdı. Telefonda "ana ekrana ekle" bu sayede uygulamayı doğru
 * adresten açar.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  return {
    manifest: `/${slug}/manifest.webmanifest`,
    appleWebApp: { capable: true, title: 'İlişki', statusBarStyle: 'black-translucent' },
    icons: {
      icon: [
        { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
        { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
      apple: '/apple-touch-icon.png',
    },
  }
}

/**
 * Gizli yolun kapısı. Slug tutmuyorsa 404 — "yanlış slug" gibi bir ipucu YOK,
 * dışarıdan bakan için sayfa hiç yokmuş gibi görünür (SPEC §6).
 *
 * Oturum kontrolü burada değil, (uygulama) grubunda: giriş sayfası da bu
 * layout'un altında yaşıyor ve oturumsuz açılabilmeli.
 */
export default async function SlugDuzeni({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  if (!slugGecerli(slug)) notFound()

  return (
    <>
      {children}
      {/* Service worker GİRİŞ EKRANINDA da kayıtlı olmalı: Chrome
          "uygulama olarak yükle" seçeneğini o an bakılan sayfaya göre
          değerlendiriyor ve uygulama ilk açıldığında görülen sayfa burası.
          Sadece giriş sonrasına koyunca seçenek hiç çıkmıyordu. */}
      <ServiceWorkerKaydi />
    </>
  )
}
