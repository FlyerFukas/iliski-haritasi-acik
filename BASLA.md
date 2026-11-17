# Buradan Başla — Claude Code'a Geçiş

Bu klasörü bilgisayarında bir yere kopyala (örn. `Belgeler/iliski-haritasi-web`),
terminalde o klasöre gir ve `claude` yaz. Aşağıdaki adımları sırayla uygula.

---

## Adım 0 — Hesaplar (~10 dk, tek seferlik)

| Hesap | Ne için | Ücret |
|-------|---------|-------|
| [supabase.com](https://supabase.com) | Veritabanı | Ücretsiz katman yeterli |
| [vercel.com](https://vercel.com) | Yayınlama | Ücretsiz katman yeterli |
| [github.com](https://github.com) | Kod deposu | Ücretsiz |

Supabase'de yeni bir proje aç (bölge: Frankfurt). Proje ayarlarından şu ikisini bir yere not et:
- **Project URL**
- **service_role** anahtarı (gizli, kimseyle paylaşma)

---

## Adım 1 — Claude Code'a ilk komut

Terminalde klasörün içinde `claude` çalıştır ve şunu yapıştır:

```
Bu klasördeki SPEC.md ve CLAUDE.md dosyalarını oku.

Ferrazzi "Never Eat Alone" sistemine dayanan kişisel network takip uygulamamı
Excel'den web'e taşıyoruz. data/seed.json içinde mevcut verim var (46 kişi, 19 temas).

Önce bana bir uygulama planı sun — hangi sırayla ne yapacağını, hangi dosyaları
oluşturacağını yaz. Kod yazmaya benim onayımdan sonra başla.

Öncelik sırası:
1. Veritabanı şeması + seed yükleme (verim güvende olsun)
2. Temas ekleme akışı (en sık kullandığım ekran, hızlı olmalı)
3. Dashboard
4. Kişi listesi ve detay
5. Çağrı listesi, hedefler, ayarlar, Excel'e aktarım
```

Claude Code planı verince gözden geçir, sonra "başla" de.

---

## Adım 2 — Ortam değişkenleri

Claude Code proje iskeletini kurunca `.env.local` dosyası isteyecek. İçeriği:

```
NEXT_PUBLIC_SUPABASE_URL=<Supabase Project URL>
SUPABASE_SERVICE_ROLE_KEY=<service_role anahtarı>
APP_PASSWORD=<kendi belirlediğin parola>
APP_SLUG=<uzun rastgele dize>
SESSION_SECRET=<uzun rastgele dize>
```

`APP_SLUG` ve `SESSION_SECRET` üretmek için Claude Code'a "bana iki tane 32 karakterlik
rastgele dize üret" dersen halleder.

Bu dosya asla GitHub'a gitmemeli — `.gitignore` içinde olduğundan emin ol.

---

## Adım 3 — Yerelde çalıştır ve doğrula

```bash
npm install
npm run seed     # verini Supabase'e yükler
npm run dev
```

Tarayıcıda `http://localhost:3000/<APP_SLUG>` adresine git. Kontrol et:

- [ ] 46 kişi göründü mü?
- [ ] Durum renkleri Excel'deki v7 dosyasıyla aynı mı? (geciken/yaklaşan sayıları tut)
- [ ] Bir temas ekle → o kişinin sonraki temas tarihi ve dashboard sayaçları değişti mi?
- [ ] Türkçe karakterli isimler bozulmadan geldi mi?

---

## Adım 4 — Yayınla

```
Bu projeyi Vercel'e deploy et. Ortam değişkenlerini Vercel panelinde nasıl
gireceğimi adım adım anlat.
```

Yayınlandıktan sonra gerçek adresin: `https://<proje>.vercel.app/<APP_SLUG>`
Bu linki telefonunun ana ekranına ekle — uygulama gibi açılır.

---

## Klasörde ne var

```
BASLA.md      → bu dosya
SPEC.md       → tam teknik şartname (Claude Code'un asıl referansı)
CLAUDE.md     → Claude Code'un her oturumda okuyacağı proje hafızası
data/
  seed.json   → Excel v7'den çıkarılmış verin (46 kişi, 19 temas, ayarlar)
```

Excel dosyan (`Iliski_Haritasi_Ferrazzi_v7.xlsx`) bu klasöre ayrıca kopyalanabilir —
web sürümü hazır olana kadar yedeğin olarak dursun.

---

## Sonraki oturumlarda

Claude Code'u aynı klasörde açtığında `CLAUDE.md` otomatik okunur, projeyi hatırlar.
Yeni bir özellik istediğinde doğrudan söyleyebilirsin, örneğin:

> "Kişi detay sayfasına doğum günü alanı ekle, dashboard'da bu ay doğum günü olanları göster."

Büyük değişikliklerde önce plan iste, sonra onayla.
