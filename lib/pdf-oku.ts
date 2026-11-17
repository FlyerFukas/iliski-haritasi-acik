/**
 * PDF → metin parçaları (konum + yazı boyutu). Yalnızca sunucuda kullanılır.
 * `unpdf`, pdf.js'in sunucusuz ortama (Vercel) uyarlanmış sürümüdür.
 */
import { getDocumentProxy } from 'unpdf'
import type { PdfParca } from './linkedin-aktar.ts'

export async function pdfParcalari(veri: Uint8Array): Promise<PdfParca[]> {
  const pdf = await getDocumentProxy(veri)
  const parcalar: PdfParca[] = []
  for (let sayfa = 1; sayfa <= Math.min(pdf.numPages, 20); sayfa++) {
    const icerik = await (await pdf.getPage(sayfa)).getTextContent()
    for (const oge of icerik.items) {
      if (!('str' in oge) || !oge.str.trim()) continue
      const [, , , d, x, y] = oge.transform as number[]
      parcalar.push({ sayfa, x, y, boyut: Math.abs(d), metin: oge.str })
    }
  }
  return parcalar
}
