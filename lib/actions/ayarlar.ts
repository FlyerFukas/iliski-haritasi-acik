'use server'

import { revalidatePath } from 'next/cache'
import { oturumZorunlu, slug } from '../auth'
import { supabaseSunucu } from '../supabase'
import { anahtar } from '../turkce'
import { beklenmeyenHata } from '../hata-metni'

export interface AyarDurumu {
  hata?: string
  kaydedildi?: boolean
}

export interface KategoriDurumu {
  hata?: string
  eklendi?: string
}

/** Ayarlardaki güncel kategori listesini okur. */
async function kategorileriOku(): Promise<string[]> {
  const db = supabaseSunucu()
  const { data, error } = await db.from('ayarlar').select('kategoriler').maybeSingle()
  if (error) {
    throw new Error(
      'Kategori listesi okunamadı. "supabase/migrations/0002_kategoriler.sql" ' +
        'dosyasını Supabase SQL Editor\'de çalıştırdın mı?',
    )
  }
  return ((data?.kategoriler as string[]) ?? []).slice()
}

async function kategorileriYaz(liste: string[]): Promise<void> {
  const db = supabaseSunucu()
  const { error } = await db
    .from('ayarlar')
    .update({ kategoriler: liste })
    .eq('tek_satir', true)
  if (error) throw new Error(beklenmeyenHata('Kategoriler kaydedilemedi', error))

  const kok = `/${slug()}`
  for (const yol of ['', '/kisiler', '/kisiler/yeni', '/ayarlar']) {
    revalidatePath(`${kok}${yol}`)
  }
}

export async function kategoriEkle(
  _onceki: KategoriDurumu,
  formData: FormData,
): Promise<KategoriDurumu> {
  await oturumZorunlu()

  const ad = String(formData.get('kategori') ?? '').trim()
  if (!ad) return { hata: 'Kategori adı gerekli.' }
  if (ad.length > 60) return { hata: 'Kategori adı çok uzun (en fazla 60 karakter).' }

  try {
    const liste = await kategorileriOku()
    // Türkçe duyarsız karşılaştırma: "Hizmet" ve "hizmet" aynı sayılır
    if (liste.some((k) => anahtar(k) === anahtar(ad))) {
      return { hata: `"${ad}" zaten listede.` }
    }
    await kategorileriYaz([...liste, ad])
    return { eklendi: ad }
  } catch (e) {
    return { hata: (e as Error).message }
  }
}

/**
 * Kategoriyi listeden çıkarır.
 *
 * Kişilerin kategori değerine DOKUNMAZ — veri silinmez (CLAUDE.md kural 1).
 * Kullanımdaki bir kategori çıkarılmak istenirse önce uyarır.
 */
export async function kategoriSil(ad: string, zorla = false): Promise<{ uyari?: string }> {
  await oturumZorunlu()

  const db = supabaseSunucu()
  const { count, error } = await db
    .from('kisiler')
    .select('*', { count: 'exact', head: true })
    .eq('kategori', ad)

  if (error) throw new Error(beklenmeyenHata('Kullanım sayılamadı', error))

  if ((count ?? 0) > 0 && !zorla) {
    return {
      uyari: `"${ad}" şu an ${count} kişide kullanılıyor. Listeden çıkarırsan o kişilerin kategorisi olduğu gibi kalır, sadece yeni seçimlerde görünmez. Yine de çıkarılsın mı?`,
    }
  }

  const liste = await kategorileriOku()
  await kategorileriYaz(liste.filter((k) => k !== ad))
  return {}
}

/**
 * Frekans gün sayılarını güncelle.
 *
 * Bu üç sayı tüm kişilerin "sonraki temas" hesabını etkiler — ama hiçbir yere
 * kopyalanmaz, her okumada buradan türetilir (CLAUDE.md kural 2). Yani
 * değiştirir değiştirmez tüm ekranlar yeni ritme göre hesaplanır.
 */
export async function ayarlariKaydet(
  _onceki: AyarDurumu,
  formData: FormData,
): Promise<AyarDurumu> {
  await oturumZorunlu()

  const oku = (ad: string): number | null => {
    const sayi = Number(String(formData.get(ad) ?? '').trim())
    return Number.isInteger(sayi) && sayi > 0 && sayi <= 3650 ? sayi : null
  }

  const gunler: Record<string, number> = {}
  for (const n of [1, 2, 3, 4, 5]) {
    const ad = `frekans_${n}_gun`
    const deger = oku(ad)
    if (deger === null) {
      return { hata: `Frekans ${n} gün sayısı 1 ile 3650 arasında tam sayı olmalı.` }
    }
    gunler[ad] = deger
  }

  const db = supabaseSunucu()
  const { error } = await db
    .from('ayarlar')
    .update(gunler)
    .eq('tek_satir', true)

  if (error) {
    if (error.code === '42703') {
      return {
        hata:
          'Frekans 4 ve 5 sütunları yok. "supabase/migrations/0003_frekans_4_5.sql" ' +
          'dosyasını Supabase SQL Editor’de çalıştır.',
      }
    }
    return { hata: beklenmeyenHata('Kaydedilemedi', error) }
  }

  // Frekans değişti → her ekrandaki hesap değişti
  const kok = `/${slug()}`
  for (const yol of ['', '/kisiler', '/cagri-listesi', '/temas', '/ayarlar']) {
    revalidatePath(`${kok}${yol}`)
  }

  return { kaydedildi: true }
}
