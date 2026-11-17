# İlişki Haritası — Web Sürümü Teknik Şartname

> Bu dosya, Excel tabanlı "İlişki Haritası" sistemini web uygulamasına taşımak için
> yazılmıştır. Kaynak sistem: `Iliski_Haritasi_Ferrazzi_v7.xlsx`.
> Kitap referansı: Keith Ferrazzi — *Never Eat Alone*, "Çınlayın" bölümü (s. 211-217).

---

## 1. Amaç

Kişisel network takip sistemi. Kullanıcı (tek kişi: Furkan) tanıdığı herkesi kaydeder,
her temasını günlüğe işler; sistem kimi ne zaman araması gerektiğini otomatik hesaplar.

**Taşınma sebebi:** Excel'de formül bakımı ve mobil erişim zor. Web sürümü her cihazdan
erişilebilir olacak, veri merkezi bir yerde yaşayacak, geçmiş hiç silinmeyecek.

---

## 2. Teknik Kararlar (kullanıcı tarafından onaylandı)

| Konu | Karar |
|------|-------|
| Framework | Next.js (App Router) + TypeScript |
| Veritabanı | Supabase (Postgres) |
| Yayın | Vercel |
| Erişim | Tahmin edilemez gizli URL + tek parola |
| Excel | Ana sistem web olacak; Excel'e dışa aktarım yedek amaçlı kalacak |
| Dil | Tamamen Türkçe arayüz |

---

## 3. Veri Modeli

### `kisiler`
| Kolon | Tip | Not |
|-------|-----|-----|
| id | uuid PK | |
| ad | text NOT NULL UNIQUE | Kişi adı. Benzersiz olmalı. |
| halka | text | `İÇ` \| `ORTA` \| `DIŞ` — duygusal yakınlık |
| kategori | text | `Kişisel` \| `Müşteriler` \| `Potansiyel Müşteriler` \| `Önemli İş Arkadaşları` \| `Tanışmak İstediklerim` |
| frekans | int | 1, 2 veya 3 — temas ritmi |
| ozel_aralik_gun | int NULL | Doluysa frekansı geçersiz kılar |
| rol, sirket, sektor, sehir | text | |
| telefon, eposta, profil_baglantisi | text | |
| kisisel_detay | text | **Kritik alan.** İş dışı bilgi: hobi, memleket, çocuk. Ferrazzi'nin sistemin kalbi saydığı veri. |
| yapilacak_hamle | text | Bir sonraki teması ne olacak |
| notlar | text | |
| arsiv | boolean default false | Silme yok, arşivleme var |
| created_at, updated_at | timestamptz | |

### `temaslar`
| Kolon | Tip | Not |
|-------|-----|-----|
| id | uuid PK | |
| kisi_id | uuid FK → kisiler.id | |
| tarih | date NOT NULL | |
| yontem | text | `E-posta` \| `Telefon` \| `Yüz yüze` \| `Mesaj` \| `Sosyal medya` \| `Diğer` |
| ofis_disi_yuz_yuze | boolean | Tanıdık→arkadaş dönüşümü için sayılır |
| not | text | |
| created_at | timestamptz | |

**Temas kayıtları asla silinmez veya değiştirilmez** (append-only). Yanlış giriş için
`iptal boolean default false` alanı kullanılabilir; hesaplamalar iptal edilmemişleri sayar.

### `hedefler` (Tanışmak İstediklerim)
`id, hedef_isim, sirket_rol, neden, ortak_baglanti, yaklasim_plani, durum, not, created_at`
`durum`: `Araştırma` | `İlk Temas Yapıldı` | `Görüşme Ayarlandı` | `Tanıştım`
"Tanıştım" olunca tek tıkla `kisiler` tablosuna taşınabilmeli.

### `ayarlar` (tek satır)
`frekans_1_gun int default 14`, `frekans_2_gun int default 30`, `frekans_3_gun int default 60`

### `degisiklik_gecmisi` (audit log)
`id, tablo, kayit_id, alan, eski_deger, yeni_deger, degisiklik_zamani`
Kişi kaydındaki her güncelleme buraya yazılır. **Eski bilgiler asla kaybolmaz.**

---

## 4. Hesaplanan Alanlar (Excel'deki formüllerin karşılığı)

Bunlar veritabanında saklanmaz, sorgu/view ile hesaplanır:

```
son_temas_tarihi   = MAX(temaslar.tarih WHERE kisi_id = X)
son_temas_yontemi  = en son temasın yöntemi
aralik_gun         = COALESCE(ozel_aralik_gun, ayarlar.frekans_N_gun)
sonraki_temas      = son_temas_tarihi + aralik_gun
temas_sayisi       = COUNT(temaslar WHERE kisi_id = X)
yontem_cesidi      = COUNT(DISTINCT yontem)
uc_yontem_tamam    = yontem_cesidi >= 3          → "✓ 3 YÖNTEM"
yuz_yuze_sayisi    = COUNT(WHERE ofis_disi_yuz_yuze = true)
arkadas_yolu       = yuz_yuze_sayisi >= 2        → "✓ ARKADAŞ"

durum:
  son_temas_tarihi YOKSA         → "⚠ KAYIT YOK"   (turuncu)
  bugün > sonraki_temas          → "GECİKTİ"       (kırmızı)
  bugün >= sonraki_temas - 7     → "YAKLAŞIYOR"    (sarı)
  aksi halde                      → "GÜNCEL"        (yeşil)
```

**Kural gerekçeleri (kitaptan):**
- 3 farklı yöntemle temas = karşı tarafın belleğine yerleşme (s. 212)
- Ofis dışında 2 yüz yüze görüşme = tanıdığın arkadaşa dönüşmesi (s. 212)
- Süreklilik olmazsa ateş söner (s. 211)

---

## 5. Ekranlar

### 5.1 Dashboard (ana sayfa)
- Dört sayaç: GECİKTİ / YAKLAŞIYOR / GÜNCEL / KAYIT YOK — tıklanınca filtrelenmiş listeye gider
- "Bugün aranacaklar" listesi: geciken + yaklaşan kişiler, en acilden sıralı,
  her satırda `yapilacak_hamle` ve tek tıkla "temas ekle" butonu
- Halka / frekans / kategori dağılım özetleri
- İlişki derinliği: kaç kişide 3-yöntem tamam, kaç kişi arkadaşa dönüşmüş
- Haftalık rutin kontrol listesi (Pazar ritüeli)

### 5.2 Kişiler
- Tablo görünümü: ad, halka, frekans, son temas, sonraki temas, durum rozeti
- Filtreler: halka, kategori, frekans, durum, sektör, şehir — çoklu seçim
- Arama: ad, şirket, kişisel detay içinde
- Sıralama: sonraki temas tarihi (varsayılan), ad, son temas
- Mobilde kart görünümüne düşsün

### 5.3 Kişi Detay
- Tüm alanlar düzenlenebilir
- O kişiye ait temas geçmişi zaman çizelgesi (en yeni üstte)
- Hesaplanan rozetler: 3-yöntem, arkadaş yolu, temas sayısı
- "Temas ekle" formu sayfa içinde
- Değişiklik geçmişi (audit log) katlanabilir bölümde

### 5.4 Temas Ekle (en sık kullanılan ekran — hız kritik)
- Tarih: varsayılan **bugün**, tek tıkla dün/önceki günler
- Kişi: aranabilir seçim kutusu (yazarken filtreleyen)
- Yöntem: büyük butonlar (Telefon / Yüz yüze / Mesaj / E-posta / …)
- "Ofis dışı yüz yüze" anahtarı
- Not alanı
- Kaydet → dashboard sayaçları anında güncellenir
- **Hedef: 3 tıkta kayıt.** Mobilde tek elle kullanılabilmeli.

### 5.5 Çağrı Listesi
- Şehir / sektör / durum filtreli, telefon numaralarıyla birlikte
- Telefon numarasına tıklayınca arama başlasın (`tel:` linki)
- Kullanım senaryosu: "İstanbul'a indim, kimleri arayayım?"

### 5.6 Tanışmak İstediklerim
- Hedef listesi, durum takibi, "Tanıştım → Kişilere taşı" aksiyonu

### 5.7 Ayarlar
- Frekans gün sayıları (14 / 30 / 60)
- Excel'e dışa aktar (xlsx indir — v7 formatıyla uyumlu)
- JSON yedek indir

---

## 6. Erişim Güvenliği

- Uygulama gizli bir yol altında: `/<UZUN_RASTGELE_SLUG>`
- İlk girişte parola sorulur, doğruysa `httpOnly` çerez (30 gün geçerli)
- Ortam değişkenleri: `APP_PASSWORD`, `APP_SLUG`, `SESSION_SECRET`
- Supabase RLS açık; istemciden doğrudan DB erişimi yok, tüm işlemler server action / route handler üzerinden
- `robots.txt` ile tüm indeksleme kapalı, sayfalarda `noindex` meta

---

## 7. Veri Aktarımı

`data/seed.json` dosyası Excel v7'den üretilmiştir:
- 46 kişi
- 19 temas kaydı
- 0 hedef
- ayarlar: frekans 1=14, 2=30, 3=60 gün

Seed script'i `npm run seed` ile çalışmalı, tekrar çalıştırıldığında kayıt tekrarlamamalı
(ad alanı unique; upsert kullan).

---

## 8. Yapılmayacaklar (kapsam dışı)

- Çok kullanıcılı yapı, ekip paylaşımı
- E-posta / SMS otomatik gönderimi
- CRM entegrasyonu, LinkedIn kazıma
- Excel ile iki yönlü canlı senkron (sadece dışa aktarım var)
- Mobil uygulama (responsive web yeterli)

---

## 9. Kabul Kriterleri

- [ ] Telefondan gizli link + parola ile girilebiliyor
- [ ] Temas eklemek 3 tıktan uzun sürmüyor
- [ ] Temas eklenince dashboard sayaçları ve kişinin durumu anında değişiyor
- [ ] 46 kişi ve 19 temas eksiksiz göründü, Excel'deki değerlerle birebir aynı
- [ ] Kişi bilgisi düzenlenince eski değer `degisiklik_gecmisi`'ne yazılıyor
- [ ] Excel'e dışa aktarım çalışıyor
- [ ] Sayfa Google'da çıkmıyor (noindex doğrulandı)
