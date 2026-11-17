import Link from 'next/link'
import { redirect } from 'next/navigation'
import { oturumVar } from '@/lib/auth'
import Gezinme from './Gezinme'

/**
 * Korumalı bölüm. Oturum yoksa giriş sayfasına.
 *
 * Not: bu kontrol yalnızca SAYFA gezinmesini korur. Yazma yapan server
 * action'lar kendi `oturumZorunlu()` çağrısını yapar (lib/auth.ts).
 */
export default async function UygulamaDuzeni({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  if (!(await oturumVar())) redirect(`/${slug}/giris`)

  return (
    <>
      <main className="kabuk">
        <header className="satir" style={{ marginBottom: 16 }}>
          <Link href={`/${slug}`} style={{ color: 'inherit', fontWeight: 700 }}>
            🕸️ İlişki Haritası
          </Link>
          <span className="aralik" />
          <Link href={`/${slug}/ayarlar`} className="btn btn-kucuk" aria-label="Ayarlar">
            ⚙️
          </Link>
        </header>
        {children}
      </main>
      <Gezinme slug={slug} />
    </>
  )
}
