import type { MetadataRoute } from 'next'

// Tüm indekslemeyi kapat (SPEC §6). Gizli slug zaten tahmin edilemez,
// bu dosya ikinci güvenlik katmanı.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', disallow: '/' }],
  }
}
