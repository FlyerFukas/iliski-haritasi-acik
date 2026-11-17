import { supabaseSunucu } from './supabase'
import {
  VARSAYILAN_AYARLAR,
  VARSAYILAN_KATEGORILER,
  bugun,
  kisiOzet,
  type Ayarlar,
  type Kisi,
  type KisiOzet,
  type Temas,
} from './hesaplama'
import { sirala } from './turkce'
import type { GecmisKaydi, Kurum } from './ortak-nokta'

/**
 * Veri okuma katmanı.
 *
 * Hesaplanan alanlar veritabanında TUTULMAZ (CLAUDE.md kural 2); her okumada
 * lib/hesaplama.ts ile türetilir. Veri kümesi küçük (onlarca kişi, yüzlerce
 * temas) olduğu için tümünü çekip bellekte hesaplamak hem en basit hem de
 * denormalizasyona düşmeyen yol.
 */

export interface Anlik {
  ozetler: KisiOzet[]
  ayarlar: Ayarlar
  bugun: string
}

function hata(nerede: string, mesaj: string): never {
  throw new Error(`${nerede}: ${mesaj}`)
}

/** Supabase tek istekte en fazla bu kadar satır döndürür. */
const SAYFA = 1000

/**
 * Bir tablonun TÜM satırlarını getirir.
 *
 * Supabase/PostgREST varsayılan olarak 1000 satırda keser ve bunu HATA OLARAK
 * BİLDİRMEZ — sessizce eksik veri döner. Temas sayısı 1000'i geçtiğinde bazı
 * kişilerin son teması okunmaz, durum hesapları sessizce yanlışlanır ve
 * yedekler eksik iner. Bu yüzden her toplu okuma sayfalanarak yapılır.
 *
 * `.range()` ile 1000'lik bloklar halinde okur; dönen blok tam dolu olduğu
 * sürece devam eder.
 */
export async function sayfali<T>(
  nerede: string,
  blokGetir: (
    baslangic: number,
    bitis: number,
  ) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const hepsi: T[] = []

  for (let baslangic = 0; ; baslangic += SAYFA) {
    const { data, error } = await blokGetir(baslangic, baslangic + SAYFA - 1)
    if (error) hata(nerede, error.message)

    const blok = (data ?? []) as T[]
    hepsi.push(...blok)

    if (blok.length < SAYFA) return hepsi
    // Beklenmedik büyüklükte veri: sonsuz döngüye girme
    if (hepsi.length > 500_000) hata(nerede, 'beklenenden çok fazla satır')
  }
}

/**
 * Ayarlar.
 *
 * `kategoriler` sütunu 0002 migration ile geliyor. Migration henüz
 * çalıştırılmadıysa sorgu hata verir; o durumda uygulamayı çökertmek yerine
 * frekansları okuyup kategorilerde varsayılana düşüyoruz.
 */
export async function ayarlariGetir(): Promise<Ayarlar> {
  const db = supabaseSunucu()

  const { data, error } = await db
    .from('ayarlar')
    .select('frekans_1_gun, frekans_2_gun, frekans_3_gun, frekans_4_gun, frekans_5_gun, kategoriler')
    .maybeSingle()

  if (!error) {
    if (!data) return { ...VARSAYILAN_AYARLAR }
    const satir = data as Partial<Ayarlar>
    return {
      frekans_1_gun: satir.frekans_1_gun ?? VARSAYILAN_AYARLAR.frekans_1_gun,
      frekans_2_gun: satir.frekans_2_gun ?? VARSAYILAN_AYARLAR.frekans_2_gun,
      frekans_3_gun: satir.frekans_3_gun ?? VARSAYILAN_AYARLAR.frekans_3_gun,
      frekans_4_gun: satir.frekans_4_gun ?? VARSAYILAN_AYARLAR.frekans_4_gun,
      frekans_5_gun: satir.frekans_5_gun ?? VARSAYILAN_AYARLAR.frekans_5_gun,
      kategoriler: satir.kategoriler?.length
        ? satir.kategoriler
        : [...VARSAYILAN_KATEGORILER],
    }
  }

  // Yeni sütunlar yoksa (0002/0003 migration çalışmamış) eskilerle devam et
  const { data: sade, error: sadeHata } = await db
    .from('ayarlar')
    .select('frekans_1_gun, frekans_2_gun, frekans_3_gun')
    .maybeSingle()

  if (sadeHata) hata('Ayarlar okunamadı', sadeHata.message)

  return {
    ...VARSAYILAN_AYARLAR,
    ...(sade ?? {}),
    kategoriler: [...VARSAYILAN_KATEGORILER],
  }
}

/**
 * Kategoriler + kişilerde fiilen kullanılan değerler.
 *
 * Listeden çıkarılmış ama hâlâ birine atanmış bir kategori varsa, o kişinin
 * kategorisi arayüzde görünmez olmasın diye listeye ekleniyor.
 */
export function kullanilanKategoriler(ayarlar: Ayarlar, ozetler: KisiOzet[]): string[] {
  const kume = new Set(ayarlar.kategoriler)
  for (const o of ozetler) if (o.kisi.kategori) kume.add(o.kisi.kategori)
  return [...kume].sort(sirala)
}

/** Arşivlenmemiş kişiler, Türkçe alfabetik. */
export async function kisileriGetir(arsivDahil = false): Promise<Kisi[]> {
  const db = supabaseSunucu()

  const kisiler = await sayfali<Kisi>('Kişiler okunamadı', (bas, bit) => {
    let sorgu = db.from('kisiler').select('*')
    if (!arsivDahil) sorgu = sorgu.eq('arsiv', false)
    // Sayfalama tutarlı olsun diye sabit bir sıra şart
    return sorgu.order('id').range(bas, bit)
  })

  return kisiler.sort((a, b) => sirala(a.ad, b.ad))
}

export async function kisiGetir(id: string): Promise<Kisi | null> {
  const db = supabaseSunucu()
  const { data, error } = await db.from('kisiler').select('*').eq('id', id).maybeSingle()
  if (error) hata('Kişi okunamadı', error.message)
  return (data as Kisi) ?? null
}

/** Bir kişinin temasları, en yeni üstte. */
export async function kisiTemaslari(kisiId: string): Promise<Temas[]> {
  const db = supabaseSunucu()
  return sayfali<Temas>('Temaslar okunamadı', (bas, bit) =>
    db
      .from('temaslar')
      .select('*')
      .eq('kisi_id', kisiId)
      .order('tarih', { ascending: false })
      .order('created_at', { ascending: false })
      .range(bas, bit),
  )
}

export interface Degisiklik {
  id: string
  alan: string
  eski_deger: string | null
  yeni_deger: string | null
  degisiklik_zamani: string
}

/** Bir kişinin değişiklik geçmişi, en yeni üstte. */
export async function degisiklikGecmisi(kisiId: string): Promise<Degisiklik[]> {
  const db = supabaseSunucu()
  return sayfali<Degisiklik>('Değişiklik geçmişi okunamadı', (bas, bit) =>
    db
      .from('degisiklik_gecmisi')
      .select('id, alan, eski_deger, yeni_deger, degisiklik_zamani')
      .in('tablo', ['kisiler', 'kisi_gecmisi'])
      .eq('kayit_id', kisiId)
      .order('degisiklik_zamani', { ascending: false })
      .range(bas, bit),
  )
}

/** Filtre açılır kutularını beslemek için mevcut sektör/şehir değerleri. */
export function benzersizDegerler(ozetler: KisiOzet[], alan: 'sektor' | 'sehir'): string[] {
  const kume = new Set<string>()
  for (const o of ozetler) {
    const deger = o.kisi[alan]
    if (deger) kume.add(deger)
  }
  return [...kume].sort(sirala)
}

/**
 * Bütün temaslar — panel, kişi listesi ve çağrı listesindeki durum
 * hesaplarının girdisi. Eksik okunursa kimin gecikmiş olduğu yanlış çıkar,
 * o yüzden sayfalı.
 */
export async function tumTemaslar(): Promise<Temas[]> {
  const db = supabaseSunucu()
  return sayfali<Temas>('Temaslar okunamadı', (bas, bit) =>
    db.from('temaslar').select('*').order('id').range(bas, bit),
  )
}

/**
 * Dashboard, kişi listesi ve çağrı listesinin ortak girdisi:
 * her kişi için hesaplanmış özet.
 */
export async function anlikDurum(arsivDahil = false): Promise<Anlik> {
  const [kisiler, temaslar, ayarlar] = await Promise.all([
    kisileriGetir(arsivDahil),
    tumTemaslar(),
    ayarlariGetir(),
  ])

  const kisiyeGore = new Map<string, Temas[]>()
  for (const t of temaslar) {
    const liste = kisiyeGore.get(t.kisi_id)
    if (liste) liste.push(t)
    else kisiyeGore.set(t.kisi_id, [t])
  }

  const bugunTarih = bugun()
  return {
    ozetler: kisiler.map((k) => kisiOzet(k, kisiyeGore.get(k.id) ?? [], ayarlar, bugunTarih)),
    ayarlar,
    bugun: bugunTarih,
  }
}

/** Temas ekleme ekranının seçim kutusu için sade liste. */
export interface KisiSecenek {
  id: string
  ad: string
  sirket: string | null
  halka: string | null
  /** Aciliyet sırasına koyabilmek için; null = temas kaydı yok. */
  kalanGun: number | null
}

export async function secilebilirKisiler(): Promise<KisiSecenek[]> {
  const { ozetler } = await anlikDurum()
  return ozetler.map((o) => ({
    id: o.kisi.id,
    ad: o.kisi.ad,
    sirket: o.kisi.sirket,
    halka: o.kisi.halka,
    kalanGun: o.kalanGun,
  }))
}

// ------------------------------------------------------------------ K-04 geçmiş

/**
 * Kurumlar ve geçmiş kayıtları.
 *
 * Tablolar 0004 migration ile geliyor. Migration henüz çalıştırılmadıysa
 * uygulama çökmez: boş liste ve `semaVar: false` döner, ortak noktalar
 * yalnızca şirket alanından hesaplanır.
 */
export interface GecmisVerisi {
  kurumlar: Kurum[]
  gecmis: GecmisKaydi[]
  semaVar: boolean
}

function tabloYok(hataNesnesi: { code?: string; message: string }): boolean {
  return (
    hataNesnesi.code === 'PGRST205' ||
    hataNesnesi.code === '42P01' ||
    /does not exist|could not find the table/i.test(hataNesnesi.message)
  )
}

export async function gecmisVerisi(): Promise<GecmisVerisi> {
  const db = supabaseSunucu()
  const deneme = await db.from('kurumlar').select('id').limit(1)
  if (deneme.error) {
    if (tabloYok(deneme.error)) return { kurumlar: [], gecmis: [], semaVar: false }
    hata('Kurumlar okunamadı', deneme.error.message)
  }

  const [kurumlar, gecmis] = await Promise.all([
    sayfali<Kurum>('Kurumlar okunamadı', (bas, bit) =>
      db.from('kurumlar').select('*').order('id').range(bas, bit),
    ),
    sayfali<GecmisKaydi>('Geçmiş okunamadı', (bas, bit) =>
      db.from('kisi_gecmisi').select('*').eq('arsiv', false).order('id').range(bas, bit),
    ),
  ])
  return { kurumlar: kurumlar.sort((a, b) => sirala(a.ad, b.ad)), gecmis, semaVar: true }
}

// ------------------------------------------------------------------ öğrenme motoru

/**
 * Beynin sorgu sonuçları (`npm run beyin` üretir). Tablo 0005 migration ile gelir;
 * yoksa ya da henüz çıktı yazılmadıysa null döner, sayfa bölümü gizlenir.
 */
export async function beyinCiktisi<T = Record<string, unknown>>(
  anahtar: string,
): Promise<{ veri: T; guncellendi: string } | null> {
  const { data, error } = await supabaseSunucu()
    .from('beyin_cikti')
    .select('veri, guncellendi')
    .eq('anahtar', anahtar)
    .maybeSingle()
  if (error || !data) return null
  return data as { veri: T; guncellendi: string }
}

/** Tüm kişilerin beyin çıktıları (ağ haritası için): kisiId → çıktı. Tablo yoksa boş. */
export async function tumBeyinKisileri<T = Record<string, unknown>>(): Promise<Map<string, T>> {
  const { data, error } = await supabaseSunucu()
    .from('beyin_cikti')
    .select('anahtar, veri')
    .like('anahtar', 'kisi:%')
  if (error || !data) return new Map()
  return new Map(data.map((r) => [(r.anahtar as string).slice(5), r.veri as T]))
}
