'use server'

import { revalidatePath } from 'next/cache'
import { oturumZorunlu, slug } from '../auth'
import { supabaseSunucu } from '../supabase'
import { KURUM_TURLERI, kurumAnahtari, type KurumTuru } from '../ortak-nokta'
import { beklenmeyenHata } from '../hata-metni'

export interface GecmisDurumu {
  hata?: string
  kaydedildi?: boolean
}

const UUID_KALIBI = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const MIGRATION_0004_MESAJ =
  'Geçmiş tabloları henüz veritabanında yok. ' +
  '"supabase/migrations/0004_gecmis.sql" dosyasını Supabase SQL Editor’de çalıştır.'

function metin(deger: FormDataEntryValue | null): string | null {
  const s = String(deger ?? '').trim()
  return s === '' ? null : s
}

function yil(deger: FormDataEntryValue | null): number | null | 'hata' {
  const s = metin(deger)
  if (s === null) return null
  const n = Number(s)
  return Number.isInteger(n) && n >= 1900 && n <= 2100 ? n : 'hata'
}

function tabloYok(h: { code?: string; message: string }): boolean {
  return h.code === 'PGRST205' || h.code === '42P01' || /does not exist|could not find the table/i.test(h.message)
}

/**
 * Kişiye geçmiş kaydı ekle: kurum (yoksa oluşturulur) + bölüm/unvan + yıllar.
 * Kurum adı normalize edilir; "TEV" ve "Tev" aynı kuruma bağlanır.
 */
export async function gecmisEkle(_onceki: GecmisDurumu, formData: FormData): Promise<GecmisDurumu> {
  await oturumZorunlu()

  const kisiId = String(formData.get('kisi_id') ?? '')
  if (!UUID_KALIBI.test(kisiId)) return { hata: 'Kişi kimliği geçersiz.' }

  const kurumAdi = metin(formData.get('kurum'))
  if (!kurumAdi) return { hata: 'Kurum adı boş olamaz.' }
  const anahtar = kurumAnahtari(kurumAdi)
  if (!anahtar) return { hata: 'Kurum adı geçersiz.' }

  const tur = String(formData.get('tur') ?? 'diger') as KurumTuru
  if (!KURUM_TURLERI.includes(tur)) return { hata: 'Kurum türü geçersiz.' }

  const bas = yil(formData.get('baslangic_yil'))
  const bit = yil(formData.get('bitis_yil'))
  if (bas === 'hata' || bit === 'hata') return { hata: 'Yıl 1900 ile 2100 arasında olmalı.' }
  if (bas !== null && bit !== null && bit < bas) return { hata: 'Bitiş yılı başlangıçtan önce olamaz.' }

  const db = supabaseSunucu()

  // kurumu bul ya da oluştur
  const { data: mevcut, error: kurumHata } = await db
    .from('kurumlar')
    .select('id')
    .eq('anahtar', anahtar)
    .maybeSingle()
  if (kurumHata) return { hata: tabloYok(kurumHata) ? MIGRATION_0004_MESAJ : beklenmeyenHata('Kurum okunamadı', kurumHata) }

  let kurumId = mevcut?.id as string | undefined
  if (!kurumId) {
    const { data: yeni, error } = await db
      .from('kurumlar')
      .insert({ ad: kurumAdi, anahtar, tur })
      .select('id')
      .single()
    if (error) return { hata: beklenmeyenHata('Kurum eklenemedi', error) }
    kurumId = yeni.id as string
  }

  const { data: kayit, error } = await db
    .from('kisi_gecmisi')
    .insert({
      kisi_id: kisiId,
      kurum_id: kurumId,
      alan: metin(formData.get('alan')),
      baslangic_yil: bas,
      bitis_yil: bit,
      guncel: formData.get('guncel') === 'on',
      not: metin(formData.get('not')),
    })
    .select('id')
    .single()
  if (error) return { hata: beklenmeyenHata('Kaydedilemedi', error) }

  await db.from('degisiklik_gecmisi').insert({
    tablo: 'kisi_gecmisi',
    kayit_id: kisiId,
    alan: 'gecmis',
    eski_deger: null,
    yeni_deger: `${kurumAdi} eklendi (${kayit.id})`,
  })

  yenile(kisiId)
  return { kaydedildi: true }
}

/** Geçmiş kaydını kaldır — silinmez, arşivlenir (CLAUDE.md kural 1). */
export async function gecmisKaldir(id: string, kisiId: string): Promise<void> {
  await oturumZorunlu()
  if (!UUID_KALIBI.test(id) || !UUID_KALIBI.test(kisiId)) throw new Error('Kimlik geçersiz.')

  const db = supabaseSunucu()
  const { error } = await db.from('kisi_gecmisi').update({ arsiv: true }).eq('id', id).eq('kisi_id', kisiId)
  if (error) throw new Error(beklenmeyenHata('Kaldırılamadı', error))

  await db.from('degisiklik_gecmisi').insert({
    tablo: 'kisi_gecmisi',
    kayit_id: kisiId,
    alan: 'gecmis',
    eski_deger: `kayıt ${id}`,
    yeni_deger: 'arşivlendi',
  })
  yenile(kisiId)
}

function yenile(kisiId: string) {
  const kok = `/${slug()}`
  revalidatePath(`${kok}/kisiler/${kisiId}`)
  revalidatePath(`${kok}/ag`)
}
