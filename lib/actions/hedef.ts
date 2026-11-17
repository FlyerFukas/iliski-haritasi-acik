'use server'

import { revalidatePath } from 'next/cache'
import { oturumZorunlu, slug } from '../auth'
import { supabaseSunucu } from '../supabase'
import { HEDEF_DURUMLARI } from '../hesaplama'
import { beklenmeyenHata } from '../hata-metni'

export interface HedefDurumu {
  hata?: string
  eklendi?: string
  guncellendi?: boolean
  /** "Tanıştım → Kişilere taşı" sonucu oluşan kişinin id'si. */
  tasinanKisiId?: string
}

const UUID_KALIBI = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function metin(deger: FormDataEntryValue | null): string | null {
  const s = String(deger ?? '').trim()
  return s === '' ? null : s
}

function yenile() {
  const kok = `/${slug()}`
  revalidatePath(`${kok}/hedefler`)
  revalidatePath(`${kok}/kisiler`)
  revalidatePath(kok)
}

/* ------------------------------------------------------------------ ekle */

export async function hedefEkle(
  _onceki: HedefDurumu,
  formData: FormData,
): Promise<HedefDurumu> {
  await oturumZorunlu()

  const isim = metin(formData.get('hedef_isim'))
  if (!isim) return { hata: 'Hedef isim gerekli.' }

  const db = supabaseSunucu()
  const { error } = await db.from('hedefler').insert({
    hedef_isim: isim,
    sirket_rol: metin(formData.get('sirket_rol')),
    neden: metin(formData.get('neden')),
    ortak_baglanti: metin(formData.get('ortak_baglanti')),
    yaklasim_plani: metin(formData.get('yaklasim_plani')),
    durum: 'Araştırma',
    not: metin(formData.get('not')),
  })

  if (error) {
    if (error.code === '23505') return { hata: 'Bu isimde bir hedef zaten var.' }
    return { hata: beklenmeyenHata('Eklenemedi', error) }
  }

  yenile()
  return { eklendi: isim }
}

/* -------------------------------------------------------------- güncelle */

export async function hedefDurumDegistir(id: string, durum: string): Promise<void> {
  await oturumZorunlu()
  if (!UUID_KALIBI.test(id)) throw new Error('Hedef kimliği geçersiz.')
  if (!HEDEF_DURUMLARI.includes(durum as never)) throw new Error('Durum geçersiz.')

  const db = supabaseSunucu()
  const { error } = await db.from('hedefler').update({ durum }).eq('id', id)
  if (error) throw new Error(beklenmeyenHata('Durum değiştirilemedi', error))

  yenile()
}

/* --------------------------------------------------- kişilere taşı ----- */

/**
 * "Tanıştım" olan hedefi `kisiler` tablosuna taşır (SPEC §5.6).
 *
 * Hedef kaydı SİLİNMEZ — durumu "Tanıştım" olur ve `tasindi_kisi_id` ile
 * oluşan kişiye bağlanır. Böylece bu tanışıklığın nereden geldiği kaybolmaz
 * (CLAUDE.md kural 1).
 */
export async function hedefiKisiyeTasi(id: string): Promise<string> {
  await oturumZorunlu()
  if (!UUID_KALIBI.test(id)) throw new Error('Hedef kimliği geçersiz.')

  const db = supabaseSunucu()

  const { data: hedef, error: okumaHatasi } = await db
    .from('hedefler')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (okumaHatasi) throw new Error(beklenmeyenHata('Hedef okunamadı', okumaHatasi))
  if (!hedef) throw new Error('Hedef bulunamadı.')
  if (hedef.tasindi_kisi_id) throw new Error('Bu hedef zaten kişilere taşınmış.')

  const { data: kisi, error: yazmaHatasi } = await db
    .from('kisiler')
    .insert({
      ad: hedef.hedef_isim,
      rol: hedef.sirket_rol,
      frekans: 2, // yeni tanışıklık: orta ritimle başla, sonra elle ayarlanır
      kategori: 'Tanışmak İstediklerim',
      yapilacak_hamle: hedef.yaklasim_plani,
      notlar: [hedef.neden, hedef.ortak_baglanti, hedef.not].filter(Boolean).join('\n'),
    })
    .select('id')
    .single()

  if (yazmaHatasi) {
    if (yazmaHatasi.code === '23505') {
      throw new Error(`"${hedef.hedef_isim}" adıyla bir kişi zaten kayıtlı.`)
    }
    throw new Error(beklenmeyenHata('Kişi oluşturulamadı', yazmaHatasi))
  }

  const { error: baglamaHatasi } = await db
    .from('hedefler')
    .update({ durum: 'Tanıştım', tasindi_kisi_id: kisi.id })
    .eq('id', id)

  if (baglamaHatasi) throw new Error(beklenmeyenHata('Hedef güncellenemedi', baglamaHatasi))

  yenile()
  return kisi.id as string
}
