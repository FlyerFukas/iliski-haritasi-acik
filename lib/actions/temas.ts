'use server'

import { revalidatePath } from 'next/cache'
import { oturumZorunlu, slug } from '../auth'
import { supabaseSunucu } from '../supabase'
import { beyniArkaplandaGuncelle } from '../beyin-tetik'
import { YONTEMLER, bugun, type Yontem } from '../hesaplama'
import { beklenmeyenHata } from '../hata-metni'

export interface TemasDurumu {
  hata?: string
  /** Kaydedilen kişinin adı — form "✓ eklendi" mesajı göstersin diye. */
  eklendi?: string
}

const UUID_KALIBI = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const TARIH_KALIBI = /^\d{4}-\d{2}-\d{2}$/

/**
 * Temas ekle — uygulamanın en sık kullanılan yazma yolu.
 *
 * Bilerek tek adım: onay ekranı, sihirbaz, zorunlu not yok (CLAUDE.md kural 3).
 * Kayıt append-only; hiçbir zaman güncelleme/silme yapılmaz.
 */
export async function temasEkle(
  _onceki: TemasDurumu,
  formData: FormData,
): Promise<TemasDurumu> {
  await oturumZorunlu()

  const kisiId = String(formData.get('kisi_id') ?? '')
  const tarih = String(formData.get('tarih') ?? '')
  const yontemGirdi = String(formData.get('yontem') ?? '')
  const ofisDisi = formData.get('ofis_disi_yuz_yuze') === 'on'
  const notGirdi = String(formData.get('not') ?? '').trim()

  if (!UUID_KALIBI.test(kisiId)) return { hata: 'Kişi seçilmedi.' }
  if (!TARIH_KALIBI.test(tarih)) return { hata: 'Tarih geçersiz.' }
  if (tarih > bugun()) return { hata: 'İleri tarihli temas eklenemez.' }
  if (!YONTEMLER.includes(yontemGirdi as Yontem)) return { hata: 'Yöntem seçilmedi.' }

  const db = supabaseSunucu()

  const { data: kisi, error: kisiHatasi } = await db
    .from('kisiler')
    .select('ad')
    .eq('id', kisiId)
    .maybeSingle()

  if (kisiHatasi) return { hata: beklenmeyenHata('Kişi doğrulanamadı', kisiHatasi) }
  if (!kisi) return { hata: 'Kişi bulunamadı.' }

  const { error } = await db.from('temaslar').insert({
    kisi_id: kisiId,
    tarih,
    yontem: yontemGirdi,
    ofis_disi_yuz_yuze: ofisDisi,
    not: notGirdi || null,
  })

  if (error) return { hata: beklenmeyenHata('Kaydedilemedi', error) }

  // Dashboard sayaçları ve kişi durumu anında değişsin (SPEC §9)
  const kok = `/${slug()}`
  revalidatePath(kok)
  revalidatePath(`${kok}/temas`)
  revalidatePath(`${kok}/kisiler`)
  revalidatePath(`${kok}/kisiler/${kisiId}`)
  revalidatePath(`${kok}/cagri-listesi`)

  // öğrenme motoru yeni teması öğrensin: yanıt döndükten sonra, arka planda
  await beyniArkaplandaGuncelle()

  return { eklendi: kisi.ad as string }
}
