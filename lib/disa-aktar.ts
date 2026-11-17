import * as XLSX from 'xlsx'
import { supabaseSunucu } from './supabase'
import { anlikDurum, ayarlariGetir, gecmisVerisi, sayfali, tumTemaslar } from './sorgular'
import { DURUM_ETIKET, bugun, type KisiOzet, type Temas } from './hesaplama'
import { sirala } from './turkce'

/**
 * Excel ve JSON dışa aktarım (SPEC §5.7).
 *
 * Sayfa adları ve kolon başlıkları kaynak `Iliski_Haritasi_Ferrazzi_v7.xlsx`
 * ile aynı tutuldu — dosyayı açınca alışık olduğun düzeni göresin.
 *
 * Tarihler Excel seri numarası değil, 'YYYY-MM-DD' metni olarak yazılır:
 * yedek dosyasının hangi programda açılırsa açılsın aynı günü göstermesi,
 * seri numarasının kayabilmesinden daha önemli (CLAUDE.md kural 4).
 */

const EVET_HAYIR = (deger: boolean) => (deger ? 'Evet' : 'Hayır')
const BOS = (deger: unknown) => deger ?? ''

const ANA_LISTE_BASLIKLAR = [
  'İsim', 'Halka', 'Kategori', 'Frekans (1/2/3)', 'Rol / Bağlam', 'Şirket',
  'Sektör', 'Şehir', 'Telefon', 'E-posta', 'Son Temas Tarihi',
  'Son Temas Yöntemi', 'Sonraki Temas (Hedef)', 'Durum', 'Temas Sayısı',
  'Yöntem Çeşidi', '3-Temas Kuralı', 'Yüz Yüze (Ofis Dışı)',
  'Arkadaş Yolu (≥2)', 'Kişisel Detay (İş Dışı)', 'Yapılacak Hamle',
  'Profil Bağlantısı', 'Notlar', 'Özel Aralık (gün)', 'Arşiv',
]

/** Ana Liste satırları — Excel sayfası ve CSV aynı kaynaktan beslenir. */
function anaListeSatirlari(ozetler: KisiOzet[]): unknown[][] {
  return ozetler.map((o) => [
    o.kisi.ad,
    BOS(o.kisi.halka),
    BOS(o.kisi.kategori),
    BOS(o.kisi.frekans),
    BOS(o.kisi.rol),
    BOS(o.kisi.sirket),
    BOS(o.kisi.sektor),
    BOS(o.kisi.sehir),
    BOS(o.kisi.telefon),
    BOS(o.kisi.eposta),
    BOS(o.sonTemasTarihi),
    BOS(o.sonTemasYontemi),
    BOS(o.sonrakiTemas),
    DURUM_ETIKET[o.durum],
    o.temasSayisi,
    o.yontemCesidi,
    o.ucYontemTamam ? '✓ 3 YÖNTEM' : '—',
    o.yuzYuzeSayisi,
    o.arkadasYolu ? '✓ ARKADAŞ' : '—',
    BOS(o.kisi.kisisel_detay),
    BOS(o.kisi.yapilacak_hamle),
    BOS(o.kisi.profil_baglantisi),
    BOS(o.kisi.notlar),
    BOS(o.kisi.ozel_aralik_gun),
    EVET_HAYIR(o.kisi.arsiv),
  ])
}

function anaListe(ozetler: KisiOzet[]) {
  return XLSX.utils.aoa_to_sheet([ANA_LISTE_BASLIKLAR, ...anaListeSatirlari(ozetler)])
}

function temasGunlugu(temaslar: Temas[], adlar: Map<string, string>) {
  const basliklar = ['Tarih', 'İsim', 'Yöntem', 'Ofis Dışı Yüz Yüze?', 'Not / Konuşulanlar', 'İptal']

  const satirlar = [...temaslar]
    .sort((a, b) => b.tarih.localeCompare(a.tarih))
    .map((t) => [
      t.tarih,
      adlar.get(t.kisi_id) ?? '(silinmiş kişi)',
      BOS(t.yontem),
      EVET_HAYIR(t.ofis_disi_yuz_yuze),
      BOS(t.not),
      EVET_HAYIR(t.iptal),
    ])

  return XLSX.utils.aoa_to_sheet([basliklar, ...satirlar])
}

function cagriListeleri(ozetler: KisiOzet[]) {
  const basliklar = [
    'İsim', 'Şehir', 'Sektör', 'Şirket', 'Halka', 'Frekans', 'Telefon',
    'Durum', 'Son Temas', 'Yapılacak Hamle', 'Sonraki Temas',
  ]

  const satirlar = ozetler.map((o) => [
    o.kisi.ad,
    BOS(o.kisi.sehir),
    BOS(o.kisi.sektor),
    BOS(o.kisi.sirket),
    BOS(o.kisi.halka),
    BOS(o.kisi.frekans),
    BOS(o.kisi.telefon),
    DURUM_ETIKET[o.durum],
    BOS(o.sonTemasTarihi),
    BOS(o.kisi.yapilacak_hamle),
    BOS(o.sonrakiTemas),
  ])

  return XLSX.utils.aoa_to_sheet([basliklar, ...satirlar])
}

function hedefSayfasi(hedefler: Array<Record<string, unknown>>) {
  const basliklar = [
    'Hedef İsim', 'Şirket / Rol', 'Neden Tanışmak İstiyorum',
    'Ortak Bağlantı / Kaynak', 'Yaklaşım Planı', 'Durum', 'Not',
  ]

  const satirlar = hedefler.map((h) => [
    BOS(h.hedef_isim),
    BOS(h.sirket_rol),
    BOS(h.neden),
    BOS(h.ortak_baglanti),
    BOS(h.yaklasim_plani),
    BOS(h.durum),
    BOS(h.not),
  ])

  return XLSX.utils.aoa_to_sheet([basliklar, ...satirlar])
}

/** Tüm veriyi tek bir xlsx tamponu olarak üretir. */
export async function excelUret(): Promise<{ tampon: Buffer; dosyaAdi: string }> {
  const db = supabaseSunucu()

  // Arşivdekiler de yedeğe girsin — yedek eksiksiz olmalı.
  // Okumalar SAYFALI: Supabase 1000 satırda sessizce keser, yedek eksik inerdi.
  const [{ ozetler }, temaslar, hedefler, ayarlar, gv] = await Promise.all([
    anlikDurum(true),
    tumTemaslar(),
    sayfali<Record<string, unknown>>('Hedefler okunamadı', (bas, bit) =>
      db.from('hedefler').select('*').order('id').range(bas, bit),
    ),
    ayarlariGetir(),
    gecmisVerisi(),
  ])

  const adlar = new Map(ozetler.map((o) => [o.kisi.id, o.kisi.ad]))
  const kurumlar = new Map(gv.kurumlar.map((k) => [k.id, k]))
  const adaGore = [...ozetler].sort((a, b) => sirala(a.kisi.ad, b.kisi.ad))

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, anaListe(adaGore), 'Ana Liste')
  XLSX.utils.book_append_sheet(
    wb,
    temasGunlugu(temaslar, adlar),
    'Temas Günlüğü',
  )
  XLSX.utils.book_append_sheet(wb, cagriListeleri(adaGore), 'Çağrı Listeleri')
  XLSX.utils.book_append_sheet(
    wb,
    hedefSayfasi(hedefler),
    'Tanışmak İstediklerim',
  )
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ['Ayar', 'Gün'],
      ['Frekans 1', ayarlar.frekans_1_gun],
      ['Frekans 2', ayarlar.frekans_2_gun],
      ['Frekans 3', ayarlar.frekans_3_gun],
      [],
      ['Dışa aktarma tarihi', bugun()],
      ['Kaynak', 'İlişki Haritası web sürümü'],
    ]),
    'Ayarlar',
  )

  const tampon = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  return { tampon, dosyaAdi: `Iliski_Haritasi_${bugun()}.xlsx` }
}

/* -------------------------------------------------------------------- CSV */

/**
 * Türk Excel'inin sorunsuz açtığı CSV üretir. İki ayrıntı kritik:
 *
 *  1. AYIRICI NOKTALI VİRGÜL. Windows'un Türkçe yerel ayarında liste ayırıcısı
 *     ';' — virgüllü CSV tek sütuna sıkışır. Ayrıca kişisel detay/hamle
 *     alanlarında zaten virgül geçiyor.
 *  2. BAŞTA BOM. Olmadan Excel dosyayı ANSI sanıp "İrem" yerine "Ýrem" gösterir.
 *
 * Alan içinde ';', '"' veya satır sonu varsa tırnaklanır; içteki tırnak
 * ikilenir (RFC 4180).
 */
function csvKacir(deger: unknown): string {
  let metin = deger === null || deger === undefined ? '' : String(deger)

  // Excel, '=' '+' '-' '@' ile başlayan hücreyi FORMÜL sanır. "Yapılacak hamle"
  // gibi serbest metin alanları pekâlâ tire ile başlayabilir; o zaman hücrede
  // veri yerine #NAME? görünür. Başa tek tırnak koyunca Excel metin olarak
  // okur ve tırnağı göstermez.
  if (/^[=+\-@\t\r]/.test(metin)) metin = `'${metin}`

  return /[;"\r\n]/.test(metin) ? `"${metin.replace(/"/g, '""')}"` : metin
}

function csvSatir(alanlar: unknown[]): string {
  return alanlar.map(csvKacir).join(';')
}

/** Ana Liste'yi CSV olarak verir (SPEC §5.7 eki). */
export async function csvUret(): Promise<{ metin: string; dosyaAdi: string }> {
  const { ozetler } = await anlikDurum(true)
  const adaGore = [...ozetler].sort((a, b) => sirala(a.kisi.ad, b.kisi.ad))

  const satirlar = [
    csvSatir(ANA_LISTE_BASLIKLAR),
    ...anaListeSatirlari(adaGore).map(csvSatir),
  ]

  return {
    // ﻿ = BOM, \r\n = Excel'in beklediği satır sonu
    metin: '﻿' + satirlar.join('\r\n') + '\r\n',
    dosyaAdi: `Iliski_Haritasi_Ana_Liste_${bugun()}.csv`,
  }
}

/**
 * JSON yedek. Biçim `data/seed.json` ile aynı — bu dosyayı `npm run seed` ile
 * boş bir veritabanına geri yükleyebilirsin.
 */
export async function jsonUret(): Promise<{ metin: string; dosyaAdi: string }> {
  const db = supabaseSunucu()

  // Okumalar SAYFALI — yedek eksik inmesin (bkz. lib/sorgular.ts sayfali()).
  const [{ ozetler }, temaslar, hedefler, ayarlar, gv] = await Promise.all([
    anlikDurum(true),
    tumTemaslar(),
    sayfali<Record<string, unknown>>('Hedefler okunamadı', (bas, bit) =>
      db.from('hedefler').select('*').order('id').range(bas, bit),
    ),
    ayarlariGetir(),
    gecmisVerisi(),
  ])

  const adlar = new Map(ozetler.map((o) => [o.kisi.id, o.kisi.ad]))
  const kurumlar = new Map(gv.kurumlar.map((k) => [k.id, k]))

  const veri = {
    ayarlar: {
      frekans_gun: {
        '1': ayarlar.frekans_1_gun,
        '2': ayarlar.frekans_2_gun,
        '3': ayarlar.frekans_3_gun,
      },
    },
    kisiler: [...ozetler]
      .sort((a, b) => sirala(a.kisi.ad, b.kisi.ad))
      .map((o) => ({
        ad: o.kisi.ad,
        halka: o.kisi.halka,
        kategori: o.kisi.kategori,
        frekans: o.kisi.frekans,
        rol: o.kisi.rol,
        sirket: o.kisi.sirket,
        sektor: o.kisi.sektor,
        sehir: o.kisi.sehir,
        telefon: o.kisi.telefon,
        eposta: o.kisi.eposta,
        ozel_aralik_gun: o.kisi.ozel_aralik_gun,
        kisisel_detay: o.kisi.kisisel_detay,
        yapilacak_hamle: o.kisi.yapilacak_hamle,
        profil_baglantisi: o.kisi.profil_baglantisi,
        notlar: o.kisi.notlar,
        arsiv: o.kisi.arsiv,
      })),
    temaslar: [...temaslar]
      .sort((a, b) => a.tarih.localeCompare(b.tarih))
      .map((t) => ({
        tarih: t.tarih,
        kisi: adlar.get(t.kisi_id) ?? null,
        yontem: t.yontem,
        ofis_disi_yuz_yuze: t.ofis_disi_yuz_yuze,
        not: t.not,
        iptal: t.iptal,
      })),
    hedefler,
    // K-04 geçmiş: kurum adı ve kişi adıyla (id'siz, okunabilir)
    gecmis: gv.gecmis.map((g) => ({
      kisi: adlar.get(g.kisi_id) ?? null,
      kurum: kurumlar.get(g.kurum_id)?.ad ?? null,
      kurum_turu: kurumlar.get(g.kurum_id)?.tur ?? null,
      alan: g.alan,
      baslangic_yil: g.baslangic_yil,
      bitis_yil: g.bitis_yil,
      guncel: g.guncel,
      not: g.not,
    })),
    yedek_zamani: new Date().toISOString(),
  }

  return {
    metin: JSON.stringify(veri, null, 2),
    dosyaAdi: `iliski-haritasi-yedek-${bugun()}.json`,
  }
}
