import { linkedinNormalize } from '@/lib/linkedin'

/** K-01: kişinin LinkedIn profiline giden küçük "in" simgesi. Adres geçersizse hiçbir şey çizmez. */
export default function LinkedinSimge({ adres, boyut = 18 }: { adres: string | null; boyut?: number }) {
  const sonuc = linkedinNormalize(adres)
  if (!sonuc?.tamam) return null
  return (
    <a
      href={sonuc.adres}
      target="_blank"
      rel="noopener noreferrer"
      title="LinkedIn profilini aç"
      aria-label="LinkedIn profilini aç"
      style={{ display: 'inline-flex', verticalAlign: 'middle', lineHeight: 0 }}
    >
      <svg width={boyut} height={boyut} viewBox="0 0 24 24" aria-hidden="true">
        <rect width="24" height="24" rx="4" fill="#0a66c2" />
        <path
          fill="#fff"
          d="M7.1 9.5H4.6V19h2.5V9.5zM5.9 5.2a1.45 1.45 0 1 0 0 2.9 1.45 1.45 0 0 0 0-2.9zM19.4 13.6c0-2.6-1.4-4.3-3.6-4.3-1.3 0-2.1.7-2.5 1.3V9.5h-2.4V19h2.5v-5c0-1.3.5-2.2 1.6-2.2s1.4.9 1.4 2.2v5h2.5l.5-5.4z"
        />
      </svg>
    </a>
  )
}
