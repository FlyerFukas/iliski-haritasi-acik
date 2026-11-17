/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // LinkedIn profil PDF'i (≤5 MB) ve Connections.csv server action ile gönderiliyor
  experimental: { serverActions: { bodySizeLimit: '6mb' } },
  // Arama motorlarına karşı ikinci savunma hattı: her yanıta noindex başlığı.
  // (Birincisi app/robots.ts, üçüncüsü layout'taki metadata.)
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' }],
      },
    ]
  },
}

export default nextConfig
