'use server'

import { revalidatePath } from 'next/cache'
import { oturumZorunlu, slug } from '../auth'
import { supabaseSunucu } from '../supabase'
import { FREKANSLAR, HALKALAR, VARSAYILAN_KATEGORILER, type Kisi } from '../hesaplama'
import { ALAN_ETIKET } from '../etiketler'
import { anahtar } from '../turkce'
import { linkedinNormalize } from '../linkedin'
import { beyniArkaplandaGuncelle } from '../beyin-tetik'
import { beklenmeyenHata } from '../hata-metni'

export interface KisiDurumu {
  hata?: string
  kaydedildi?: boolean
  /** Kaç alan değişti — kullanıcıya "3 alan güncellendi" demek için. */
  degisenSayisi?: number
}

export interface YeniKisiDurumu {
  hata?: string
  /** Oluşan kaydın id'si — form onu detay sayfasına yönlendirir. */
  olusanId?: string
}

/** Formdan gelip veritabanına yazılabilecek alanlar. `id`, `created_at` vb. dışarıda. */
const DUZENLENEBILIR = [
  'ad',
  'halka',
  'kategori',
  'frekans',
  'ozel_aralik_gun',
  'rol',
  'sirket',
  'sektor',
  'sehir',
  'telefon',
  'eposta',
  'profil_baglantisi',
  'kisisel_detay',
  'yapilacak_hamle',
  'notlar',
] as const

type Alan = (typeof DUZENLENEBILIR)[number]

const SAYISAL: Alan[] = ['frekans', 'ozel_aralik_gun']

/** Frekans 4/5 veritabanı kısıtına takılırsa gösterilecek açıklama. */
const MIGRATION_0003_MESAJ =
  'Frekans 4 ve 5 henüz veritabanında tanımlı değil. ' +
  '"supabase/migrations/0003_frekans_4_5.sql" dosyasını Supabase SQL Editor’de çalıştır.'

const UUID_KALIBI = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Karşılaştırma ve audit kaydı için normalize metin. null/'' aynı sayılır. */
function metin(deger: unknown): string | null {
  if (deger === null || deger === undefined) return null
  const s = String(deger).trim()
  return s === '' ? null : s
}

/**
 * K-01: LinkedIn adresini doğrula, normalize et, başka kişide var mı bak.
 * Aynı profil iki kişiye verilemez: büyük olasılıkla aynı kişi iki kez girilmiştir.
 */
async function linkedinHazirla(
  ham: string | null,
  haricId: string | null,
): Promise<{ deger: string | null } | { hata: string }> {
  const sonuc = linkedinNormalize(ham)
  if (sonuc === null) return { deger: null }
  if (!sonuc.tamam) return { hata: sonuc.hata }

  const db = supabaseSunucu()
  const { data } = await db.from('kisiler').select('id, ad, profil_baglantisi').not('profil_baglantisi', 'is', null)
  const cakisan = (data ?? []).find((k) => {
    if (k.id === haricId) return false
    const diger = linkedinNormalize(k.profil_baglantisi as string)
    return diger?.tamam === true && diger.kimlik === sonuc.kimlik
  })
  if (cakisan) {
    return { hata: `Bu LinkedIn profili "${cakisan.ad}" kişisinde kayıtlı. Aynı kişi iki kez girilmiş olabilir.` }
  }
  return { deger: sonuc.adres }
}

/**
 * Kategori geçerli mi — liste artık kodda değil, `ayarlar.kategoriler`'de.
 *
 * Listeden çıkarılmış ama bir kişide hâlâ duran bir kategori de kabul edilir;
 * aksi halde o kişiyi kaydetmek imkânsız hale gelirdi.
 */
async function kategoriGecerli(kategori: string): Promise<boolean> {
  const db = supabaseSunucu()

  const { data } = await db.from('ayarlar').select('kategoriler').maybeSingle()
  const liste = (data?.kategoriler as string[] | undefined) ?? VARSAYILAN_KATEGORILER
  if (liste.includes(kategori)) return true

  const { count } = await db
    .from('kisiler')
    .select('*', { count: 'exact', head: true })
    .eq('kategori', kategori)
  return (count ?? 0) > 0
}

/**
 * Yeni kişi ekle.
 *
 * Tek zorunlu alan: ad. Yeni tanıştığın birini not almak saniyeler sürmeli;
 * geri kalanı sonra detay sayfasından doldurulur (CLAUDE.md kural 3'ün ruhu).
 * Kayıt açıldıktan sonra çağıran taraf detay sayfasına yönlendirir.
 */
export async function kisiEkle(
  _onceki: YeniKisiDurumu,
  formData: FormData,
): Promise<YeniKisiDurumu> {
  await oturumZorunlu()

  const ad = metin(formData.get('ad'))
  if (!ad) return { hata: 'Ad gerekli.' }

  const halka = metin(formData.get('halka'))
  const kategori = metin(formData.get('kategori'))
  const frekansHam = metin(formData.get('frekans'))
  const frekans = frekansHam === null ? null : Number(frekansHam)

  if (halka !== null && !HALKALAR.includes(halka as never)) {
    return { hata: 'Halka geçersiz.' }
  }
  if (kategori !== null && !(await kategoriGecerli(kategori))) {
    return { hata: 'Kategori geçersiz.' }
  }
  if (frekans !== null && !FREKANSLAR.includes(frekans as never)) {
    return { hata: 'Frekans 1 ile 5 arasında olmalı.' }
  }

  const linkedin = await linkedinHazirla(metin(formData.get('profil_baglantisi')), null)
  if ('hata' in linkedin) return { hata: linkedin.hata }

  const db = supabaseSunucu()

  // Türkçe normalize ile çakışma kontrolü: "Ayşe Işık" ve "ayse isik"
  // aynı kişidir. Veritabanı UNIQUE kısıtı bunu yakalayamaz (CLAUDE.md kural 5).
  const { data: mevcutlar, error: okumaHatasi } = await db.from('kisiler').select('id, ad')
  if (okumaHatasi) return { hata: beklenmeyenHata('Kişiler okunamadı', okumaHatasi) }

  const yeniAnahtar = anahtar(ad)
  const cakisan = (mevcutlar ?? []).find((k) => anahtar(k.ad as string) === yeniAnahtar)
  if (cakisan) {
    return { hata: `"${cakisan.ad}" zaten kayıtlı — aynı kişi olabilir.` }
  }

  const { data, error } = await db
    .from('kisiler')
    .insert({
      ad,
      halka,
      kategori,
      frekans,
      rol: metin(formData.get('rol')),
      sirket: metin(formData.get('sirket')),
      telefon: metin(formData.get('telefon')),
      kisisel_detay: metin(formData.get('kisisel_detay')),
      profil_baglantisi: linkedin.deger,
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') return { hata: 'Bu adda bir kişi zaten var.' }
    if (error.code === '23514') return { hata: MIGRATION_0003_MESAJ }
    return { hata: beklenmeyenHata('Eklenemedi', error) }
  }

  yenile(data.id as string)
  await beyniArkaplandaGuncelle() // yeni kişi beyne katılsın (arka planda)
  return { olusanId: data.id as string }
}

/**
 * Kişi bilgisi güncelle.
 *
 * Değişen HER alanın eski değeri `degisiklik_gecmisi`'ne yazılır — eski bilgi
 * asla kaybolmaz (CLAUDE.md kural 1). Hiçbir alan değişmediyse ne güncelleme
 * ne de audit kaydı yapılır.
 */
export async function kisiGuncelle(
  _onceki: KisiDurumu,
  formData: FormData,
): Promise<KisiDurumu> {
  await oturumZorunlu()

  const id = String(formData.get('id') ?? '')
  if (!UUID_KALIBI.test(id)) return { hata: 'Kişi kimliği geçersiz.' }

  const db = supabaseSunucu()

  const { data: mevcut, error: okumaHatasi } = await db
    .from('kisiler')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (okumaHatasi) return { hata: beklenmeyenHata('Kişi okunamadı', okumaHatasi) }
  if (!mevcut) return { hata: 'Kişi bulunamadı.' }

  const eski = mevcut as Kisi
  const yeni: Record<string, string | number | null> = {}
  const degisenler: Array<{ alan: string; eski: string | null; yeni: string | null }> = []

  for (const alan of DUZENLENEBILIR) {
    if (!formData.has(alan)) continue // form bu alanı hiç göndermediyse dokunma

    const ham = metin(formData.get(alan))

    let deger: string | number | null = ham
    if (alan === 'profil_baglantisi') {
      const linkedin = await linkedinHazirla(ham, id)
      if ('hata' in linkedin) return { hata: linkedin.hata }
      deger = linkedin.deger
    }
    if (SAYISAL.includes(alan) && ham !== null) {
      const sayi = Number(ham)
      if (!Number.isInteger(sayi) || sayi <= 0) {
        return { hata: `${ALAN_ETIKET[alan]} pozitif tam sayı olmalı.` }
      }
      deger = sayi
    }

    const oncekiMetin = metin(eski[alan as keyof Kisi])
    const yeniMetin = deger === null ? null : String(deger)
    if (oncekiMetin === yeniMetin) continue

    yeni[alan] = deger
    degisenler.push({ alan, eski: oncekiMetin, yeni: yeniMetin })
  }

  // doğrulamalar
  if (yeni.ad === null) return { hata: 'Ad boş bırakılamaz.' }
  if (yeni.halka != null && !HALKALAR.includes(yeni.halka as never)) {
    return { hata: 'Halka geçersiz.' }
  }
  if (yeni.kategori != null && !(await kategoriGecerli(String(yeni.kategori)))) {
    return { hata: 'Kategori geçersiz.' }
  }
  if (yeni.frekans != null && !FREKANSLAR.includes(yeni.frekans as never)) {
    return { hata: 'Frekans 1 ile 5 arasında olmalı.' }
  }

  if (degisenler.length === 0) return { kaydedildi: true, degisenSayisi: 0 }

  const { error: yazmaHatasi } = await db.from('kisiler').update(yeni).eq('id', id)
  if (yazmaHatasi) {
    if (yazmaHatasi.code === '23505') return { hata: 'Bu adda başka bir kişi zaten var.' }
    if (yazmaHatasi.code === '23514') return { hata: MIGRATION_0003_MESAJ }
    return { hata: beklenmeyenHata('Kaydedilemedi', yazmaHatasi) }
  }

  const { error: auditHatasi } = await db.from('degisiklik_gecmisi').insert(
    degisenler.map((d) => ({
      tablo: 'kisiler',
      kayit_id: id,
      alan: d.alan,
      eski_deger: d.eski,
      yeni_deger: d.yeni,
    })),
  )
  // Audit yazılamazsa kullanıcı bilsin — sessizce yutma.
  if (auditHatasi) {
    return {
      hata: beklenmeyenHata('Kayıt güncellendi ama değişiklik geçmişine yazılamadı', auditHatasi),
    }
  }

  yenile(id)
  return { kaydedildi: true, degisenSayisi: degisenler.length }
}

/** Arşivle / arşivden çıkar. Silme yok (CLAUDE.md kural 1). */
export async function arsivDegistir(id: string, arsivle: boolean): Promise<void> {
  await oturumZorunlu()
  if (!UUID_KALIBI.test(id)) throw new Error('Kişi kimliği geçersiz.')

  const db = supabaseSunucu()
  const { error } = await db.from('kisiler').update({ arsiv: arsivle }).eq('id', id)
  if (error) throw new Error(beklenmeyenHata('Arşiv durumu değiştirilemedi', error))

  await db.from('degisiklik_gecmisi').insert({
    tablo: 'kisiler',
    kayit_id: id,
    alan: 'arsiv',
    eski_deger: String(!arsivle),
    yeni_deger: String(arsivle),
  })

  yenile(id)
}

function yenile(kisiId: string) {
  const kok = `/${slug()}`
  revalidatePath(kok)
  revalidatePath(`${kok}/kisiler`)
  revalidatePath(`${kok}/kisiler/${kisiId}`)
  revalidatePath(`${kok}/cagri-listesi`)
  revalidatePath(`${kok}/temas`)
}
