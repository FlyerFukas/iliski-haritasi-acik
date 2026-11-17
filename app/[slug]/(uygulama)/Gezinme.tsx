'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const BAGLANTILAR = [
  { yol: '', simge: '🏠', etiket: 'Panel' },
  { yol: '/temas', simge: '➕', etiket: 'Temas' },
  { yol: '/kisiler', simge: '👥', etiket: 'Kişiler' },
  { yol: '/cagri-listesi', simge: '📞', etiket: 'Çağrı' },
  { yol: '/ag', simge: '🧠', etiket: 'Ağ' },
  { yol: '/hedefler', simge: '🎯', etiket: 'Hedefler' },
]

export default function Gezinme({ slug }: { slug: string }) {
  const suanki = usePathname()
  const kok = `/${slug}`

  return (
    <nav className="gezinme" aria-label="Ana gezinme">
      {BAGLANTILAR.map((b) => {
        const adres = `${kok}${b.yol}`
        const etkin = b.yol === '' ? suanki === kok : suanki.startsWith(adres)
        return (
          <Link key={b.yol} href={adres} aria-current={etkin ? 'page' : undefined}>
            <span className="gezinme-simge" aria-hidden="true">
              {b.simge}
            </span>
            {b.etiket}
          </Link>
        )
      })}
    </nav>
  )
}
