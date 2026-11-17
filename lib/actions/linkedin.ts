'use server'

import { revalidatePath } from 'next/cache'
import { oturumZorunlu, slug } from '../auth'
import { supabaseSunucu } from '../supabase'
import { gecmisVerisi, kisileriGetir } from '../sorgular'
import { pdfParcalari } from '../pdf-oku'
import {
  baglantilariAyristir,
  baglantiOnerisi,
  kurumTuruTahmin,
  profilAyristir,
  profilOnerisi,
  type Baglanti,
  type MevcutKisi,
  type Oneri,
} from '../linkedin-aktar'
import {
  alanlariYaz,
  bosSonuc,
  gecmisleriYaz,
  linkedinSahipleriniOku,
  type AlanSecimi,
  type GecmisSecimi,
  type YazimSonucu,
} from '../aktarim-yaz'
import { linkedinNormalize } from '../linkedin'
import { beyniArkaplandaGuncelle } from '../beyin-tetik'
import { alanAnahtari, kurumAnahtari } from '../ortak-nokta'
import { anahtar } from '../turkce'
import type { Kisi } from '../hesaplama'
import { beklenmeyenHata } from '../hata-metni'

const UUID_KALIBI = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const AZAMI_PDF = 5 * 1024 * 1024

/** Kişilerin mevcut alanları + geçmiş izleri (öneri hesabı için). */
async function mevcutlar(): Promise<{ kisiler: Kisi[]; harita: Map<string, MevcutKisi> }> {
  const [kisiler, gv] = await Promise.all([kisileriGetir(true), gecmisVerisi()])
  const kurum = new Map(gv.kurumlar.map((k) => [k.id, k.anahtar]))
  const harita = new Map<string, MevcutKisi>()
  for (const k of kisiler) {
    harita.set(k.id, {
      alanlar: {
        profil_baglantisi: k.profil_baglantisi,
        eposta: k.eposta,
        sirket: k.sirket,
        rol: k.rol,
        sehir: k.sehir,
      },
      izler: gv.gecmis
        .filter((g) => g.kisi_id === k.id)
        .map((g) => ({ kurumAnahtari: kurum.get(g.kurum_id) ?? '', alanAnahtari: alanAnahtari(g.alan) })),
    })
  }
  return { kisiler, harita }
}

// ------------------------------------------------------------------ PDF

export interface PdfOnizleme {
  hata?: string
  /** Kişi verilmeden yüklendiyse: PDF'in eşleştiği kayıtlı kişi (yoksa null → yeni kişi). */
  eslesen?: { kisiId: string; kisiAd: string; nasil: 'linkedin' | 'ad' } | null
  pdfAd?: string | null
  baslik?: string | null
  /** PDF'teki ad kişinin adıyla uyuşmuyor: yanlış kişinin PDF'i olabilir. */
  adUyumsuz?: boolean
  oneri?: Oneri
}

export async function pdfOnizle(formData: FormData): Promise<PdfOnizleme> {
  await oturumZorunlu()
  const verilenId = String(formData.get('kisi_id') ?? '')
  if (verilenId && !UUID_KALIBI.test(verilenId)) return { hata: 'Kişi kimliği geçersiz.' }
  const dosya = formData.get('pdf')
  if (!(dosya instanceof File) || dosya.size === 0) return { hata: 'PDF dosyası seçilmedi.' }
  if (dosya.size > AZAMI_PDF) return { hata: 'PDF 5 MB’den büyük olamaz.' }

  let profil
  try {
    profil = profilAyristir(await pdfParcalari(new Uint8Array(await dosya.arrayBuffer())))
  } catch {
    return { hata: 'PDF okunamadı. LinkedIn’de profil → Diğer → “PDF olarak kaydet” ile indirilen dosyayı seç.' }
  }
  if (!profil.ad && profil.deneyimler.length === 0 && profil.egitimler.length === 0) {
    return { hata: 'Bu dosya bir LinkedIn profil PDF’ine benzemiyor.' }
  }

  const { kisiler, harita } = await mevcutlar()

  // Kişi verilmediyse: önce LinkedIn adresiyle, sonra Türkçe normalize adla ara
  if (!verilenId) {
    const kimlik = linkedinNormalize(profil.linkedin)
    const liKisi = kimlik?.tamam
      ? kisiler.find((k) => {
          const n = linkedinNormalize(k.profil_baglantisi)
          return n?.tamam && n.kimlik === kimlik.kimlik
        })
      : undefined
    const bulunan = liKisi ?? kisiler.find((k) => profil.ad && anahtar(k.ad) === anahtar(profil.ad))
    const bos: MevcutKisi = { alanlar: {}, izler: [] }
    return {
      pdfAd: profil.ad,
      baslik: profil.baslik,
      eslesen: bulunan ? { kisiId: bulunan.id, kisiAd: bulunan.ad, nasil: liKisi ? 'linkedin' : 'ad' } : null,
      oneri: profilOnerisi(bulunan ? harita.get(bulunan.id)! : bos, profil, kurumAnahtari, alanAnahtari),
    }
  }

  const kisiId = verilenId
  const kisi = kisiler.find((k) => k.id === kisiId)
  if (!kisi) return { hata: 'Kişi bulunamadı.' }

  // Ad uyumu: PDF adının sözcüklerinden en az biri kişinin adında geçmeli
  const kisiSozcukleri = new Set(anahtar(kisi.ad).split(' '))
  const adUyumsuz = Boolean(profil.ad) && !anahtar(profil.ad).split(' ').some((s) => s.length > 1 && kisiSozcukleri.has(s))

  return {
    pdfAd: profil.ad,
    baslik: profil.baslik,
    adUyumsuz,
    oneri: profilOnerisi(harita.get(kisiId)!, profil, kurumAnahtari, alanAnahtari),
  }
}

export async function pdfUygula(
  kisiId: string,
  alanlar: AlanSecimi[],
  gecmis: Omit<GecmisSecimi, 'kisiId'>[],
): Promise<YazimSonucu> {
  await oturumZorunlu()
  if (!UUID_KALIBI.test(kisiId)) throw new Error('Kişi kimliği geçersiz.')
  const db = supabaseSunucu()
  const sonuc = bosSonuc()
  await alanlariYaz(db, kisiId, alanlar, 'LinkedIn PDF', await linkedinSahipleriniOku(db), sonuc)
  await gecmisleriYaz(db, gecmis.map((g) => ({ ...g, kisiId })), 'LinkedIn PDF', sonuc)
  yenile([kisiId])
  return sonuc
}

/** PDF'ten yeni kişi aç: ad + seçilen alanlar + geçmiş. Ad ya da LinkedIn çakışırsa açmaz. */
export async function pdfIleKisiEkle(
  ad: string,
  alanlar: AlanSecimi[],
  gecmis: Omit<GecmisSecimi, 'kisiId'>[],
): Promise<YazimSonucu & { kisiId?: string; hata?: string }> {
  await oturumZorunlu()
  const temizAd = ad?.trim()
  if (!temizAd) return { ...bosSonuc(), hata: 'Ad gerekli.' }

  const db = supabaseSunucu()
  const { data: mevcut, error } = await db.from('kisiler').select('id, ad')
  if (error) return { ...bosSonuc(), hata: beklenmeyenHata('Kişiler okunamadı', error) }
  const cakisan = (mevcut ?? []).find((k) => anahtar(k.ad as string) === anahtar(temizAd))
  if (cakisan) return { ...bosSonuc(), hata: `"${cakisan.ad}" zaten kayıtlı. Onun sayfasından PDF yükle.` }

  const sahipler = await linkedinSahipleriniOku(db)
  const li = alanlar.find((a) => a.alan === 'profil_baglantisi')
  const n = linkedinNormalize(li?.yeni)
  if (n?.tamam && sahipler.has(n.kimlik)) {
    return { ...bosSonuc(), hata: 'Bu LinkedIn profili başka bir kişide kayıtlı.' }
  }

  // Yeni kişi formundaki varsayılan frekans (2) ile aç
  const { data: yeni, error: e } = await db.from('kisiler').insert({ ad: temizAd, frekans: 2 }).select('id').single()
  if (e) return { ...bosSonuc(), hata: beklenmeyenHata('Eklenemedi', e) }
  const kisiId = yeni.id as string
  await db.from('degisiklik_gecmisi').insert({
    tablo: 'kisiler',
    kayit_id: kisiId,
    alan: 'kaynak',
    eski_deger: null,
    yeni_deger: 'LinkedIn PDF: yeni kişi',
  })

  const sonuc = bosSonuc()
  await alanlariYaz(db, kisiId, alanlar, 'LinkedIn PDF', sahipler, sonuc)
  await gecmisleriYaz(db, gecmis.map((g) => ({ ...g, kisiId })), 'LinkedIn PDF', sonuc)
  yenile([kisiId])
  await beyniArkaplandaGuncelle()
  return { ...sonuc, kisiId }
}

// ------------------------------------------------------------------ CSV

export interface CsvEslesme {
  kisiId: string
  kisiAd: string
  arsivde: boolean
  nasil: 'linkedin' | 'ad'
  baglanti: Baglanti
  oneri: Oneri
}

export interface CsvRapor {
  hata?: string
  toplam?: number
  eslesen?: CsvEslesme[]
  /** Uygulamada olmayan bağlantılar: otomatik EKLENMEZ, kullanıcı seçer. */
  yeniAday?: Baglanti[]
  degisiklikYok?: number
}

export async function csvKarsilastir(metin: string): Promise<CsvRapor> {
  await oturumZorunlu()
  let baglantilar: Baglanti[]
  try {
    baglantilar = baglantilariAyristir(metin)
  } catch (e) {
    return { hata: (e as Error).message }
  }

  const { kisiler, harita } = await mevcutlar()
  const linkedinIle = new Map<string, Kisi>()
  const adIle = new Map<string, Kisi>()
  for (const k of kisiler) {
    const n = linkedinNormalize(k.profil_baglantisi)
    if (n?.tamam) linkedinIle.set(n.kimlik, k)
    adIle.set(anahtar(k.ad), k)
  }

  const eslesen: CsvEslesme[] = []
  const yeniAday: Baglanti[] = []
  let degisiklikYok = 0
  for (const b of baglantilar) {
    const n = linkedinNormalize(b.linkedin)
    const liKisi = n?.tamam ? linkedinIle.get(n.kimlik) : undefined
    const kisi = liKisi ?? adIle.get(anahtar(b.ad))
    if (!kisi) {
      yeniAday.push(b)
      continue
    }
    const oneri = baglantiOnerisi(harita.get(kisi.id)!, b, kurumAnahtari, alanAnahtari)
    if (oneri.alanlar.length === 0 && oneri.gecmis.every((g) => g.zatenVar)) {
      degisiklikYok++
      continue
    }
    eslesen.push({ kisiId: kisi.id, kisiAd: kisi.ad, arsivde: kisi.arsiv, nasil: liKisi ? 'linkedin' : 'ad', baglanti: b, oneri })
  }

  return { toplam: baglantilar.length, eslesen, yeniAday, degisiklikYok }
}

export interface CsvUygulamaSonucu extends YazimSonucu {
  eklenenKisi: number
}

export async function csvUygula(
  guncellemeler: { kisiId: string; alanlar: AlanSecimi[]; gecmis: Omit<GecmisSecimi, 'kisiId'>[] }[],
  yeniKisiler: Baglanti[],
): Promise<CsvUygulamaSonucu> {
  await oturumZorunlu()
  const db = supabaseSunucu()
  const sonuc: CsvUygulamaSonucu = { ...bosSonuc(), eklenenKisi: 0 }
  const sahipler = await linkedinSahipleriniOku(db)
  const gecmis: GecmisSecimi[] = []

  for (const g of guncellemeler) {
    if (!UUID_KALIBI.test(g.kisiId)) continue
    await alanlariYaz(db, g.kisiId, g.alanlar, 'LinkedIn CSV', sahipler, sonuc)
    gecmis.push(...g.gecmis.map((x) => ({ ...x, kisiId: g.kisiId })))
  }

  // Yeni kişiler: ad çakışması (Türkçe normalize) ve LinkedIn çakışması varsa eklenmez
  if (yeniKisiler.length) {
    const { data: mevcut } = await db.from('kisiler').select('ad')
    const adlar = new Set((mevcut ?? []).map((k) => anahtar(k.ad as string)))
    for (const b of yeniKisiler) {
      const ad = b.ad?.trim()
      if (!ad || adlar.has(anahtar(ad))) {
        sonuc.uyarilar.push(`"${ad}" zaten kayıtlı, yeni kişi olarak eklenmedi.`)
        continue
      }
      const n = linkedinNormalize(b.linkedin)
      if (n?.tamam && sahipler.has(n.kimlik)) {
        sonuc.uyarilar.push(`"${ad}": LinkedIn adresi başka bir kişide kayıtlı, eklenmedi.`)
        continue
      }
      const { data, error } = await db
        .from('kisiler')
        .insert({
          ad,
          profil_baglantisi: n?.tamam ? n.adres : null,
          eposta: b.eposta,
          sirket: b.sirket,
          rol: b.pozisyon,
        })
        .select('id')
        .single()
      if (error) {
        sonuc.uyarilar.push(beklenmeyenHata(`"${ad}" eklenemedi`, error))
        continue
      }
      adlar.add(anahtar(ad))
      if (n?.tamam) sahipler.set(n.kimlik, data.id)
      sonuc.eklenenKisi++
      await db.from('degisiklik_gecmisi').insert({
        tablo: 'kisiler',
        kayit_id: data.id,
        alan: 'kaynak',
        eski_deger: null,
        yeni_deger: 'LinkedIn CSV: yeni kişi',
      })
      if (b.sirket) {
        gecmis.push({ kisiId: data.id, kurum: b.sirket, tur: kurumTuruTahmin(b.sirket), alan: b.pozisyon, basYil: null, bitYil: null, guncel: true })
      }
    }
  }

  await gecmisleriYaz(db, gecmis, 'LinkedIn CSV', sonuc)
  yenile([])
  if (sonuc.eklenenKisi > 0) await beyniArkaplandaGuncelle()
  return sonuc
}

function yenile(kisiIdleri: string[]) {
  const kok = `/${slug()}`
  revalidatePath(kok)
  revalidatePath(`${kok}/kisiler`)
  revalidatePath(`${kok}/ag`)
  for (const id of kisiIdleri) revalidatePath(`${kok}/kisiler/${id}`)
}
