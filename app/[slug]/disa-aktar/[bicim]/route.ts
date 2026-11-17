import { oturumVar, slugGecerli } from '@/lib/auth'
import { csvUret, excelUret, jsonUret } from '@/lib/disa-aktar'

/**
 * Yedek indirme: /<slug>/disa-aktar/excel | csv | json
 *
 * DİKKAT: Route handler'lar layout'lardan geçmez — bu yüzden slug ve oturum
 * kontrolünü burada kendimiz yapıyoruz. Aksi halde yedek dosyası korumasız
 * kalırdı.
 */
export async function GET(
  _istek: Request,
  { params }: { params: Promise<{ slug: string; bicim: string }> },
) {
  const { slug, bicim } = await params

  if (!slugGecerli(slug)) return yanitYok()
  if (!(await oturumVar())) return yanitYok()

  try {
    if (bicim === 'excel') {
      const { tampon, dosyaAdi } = await excelUret()
      return new Response(new Uint8Array(tampon), {
        headers: {
          'Content-Type':
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': indirmeBasligi(dosyaAdi),
          'Cache-Control': 'no-store',
        },
      })
    }

    if (bicim === 'csv') {
      const { metin, dosyaAdi } = await csvUret()
      return new Response(metin, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': indirmeBasligi(dosyaAdi),
          'Cache-Control': 'no-store',
        },
      })
    }

    if (bicim === 'json') {
      const { metin, dosyaAdi } = await jsonUret()
      return new Response(metin, {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': indirmeBasligi(dosyaAdi),
          'Cache-Control': 'no-store',
        },
      })
    }

    return yanitYok()
  } catch (e) {
    // Ham metin günlüğe; kullanıcı ne yapacağını görür (erişilebilirlik B12).
    console.error('[disa-aktar]', e)
    return new Response('Yedek üretilemedi. Sayfayı yenileyip tekrar dene; verin yerinde duruyor.', {
      status: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }
}

/** Türkçe karakterli dosya adı için RFC 5987 biçimi. */
function indirmeBasligi(dosyaAdi: string): string {
  const sade = dosyaAdi.replace(/[^\x20-\x7E]/g, '_')
  return `attachment; filename="${sade}"; filename*=UTF-8''${encodeURIComponent(dosyaAdi)}`
}

function yanitYok() {
  return new Response('Sayfa bulunamadı.', {
    status: 404,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
