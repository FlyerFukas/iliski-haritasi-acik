import { redirect } from 'next/navigation'
import { oturumVar } from '@/lib/auth'
import GirisFormu from './GirisFormu'

export default async function GirisSayfasi({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  // Zaten girmişse doğrudan uygulamaya
  if (await oturumVar()) redirect(`/${slug}`)

  return (
    <main className="kabuk" style={{ maxWidth: 380, paddingTop: 72 }}>
      <div className="yigin">
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2.4rem', lineHeight: 1 }}>🕸️</div>
          <h1 style={{ marginTop: 10 }}>İlişki Haritası</h1>
        </div>
        <GirisFormu />
      </div>
    </main>
  )
}
