# Yayınlama — GitHub + Vercel

Uygulamayı telefonundan açılabilir hale getirmek için tek seferlik adımlar.
Toplam ~15 dakika.

---

## ⚠️ Önce bunu oku

`data/seed.json` ve `Iliski_Haritasi_Ferrazzi_v7.xlsx` dosyaları **46 gerçek kişinin
özel bilgisini** taşıyor: telefon, memleket, aile bağı, iş süreçleri. Bunlar senin
verin değil, **başkalarının** verisi.

**GitHub deposu MUTLAKA private olmalı.** Public yaparsan bu bilgiler indekslenir ve
geri alınamaz. Vercel ücretsiz katmanı private depodan sorunsuz yayın yapar.

---

## Adım 1 — GitHub deposu (private)

1. [github.com/new](https://github.com/new) adresine git
2. **Repository name:** `iliski-haritasi`
3. **Private** seç — Public DEĞİL
4. "Add a README" / "Add .gitignore" kutularını **işaretleme** (zaten var)
5. **Create repository**

Sonra açılan sayfadaki adresi kullanarak, proje klasöründe:

```bash
git remote add origin https://github.com/<KULLANICI_ADIN>/iliski-haritasi.git
git branch -M main
git push -u origin main
```

GitHub parola sormaz; tarayıcıda oturum açmanı ister ya da bir token verir.

---

## Adım 2 — Vercel'e bağla

1. [vercel.com/new](https://vercel.com/new) → GitHub hesabınla giriş yap
2. `iliski-haritasi` deposunu **Import** et
3. Framework otomatik **Next.js** algılanır — dokunma
4. **Deploy'a HENÜZ BASMA.** Önce ortam değişkenlerini gir (Adım 3)

---

## Adım 3 — Ortam değişkenleri

Import ekranında **Environment Variables** bölümünü aç. `.env.local` dosyandaki
beş satırın **aynısını** tek tek gir:

| Ad | Değer |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role anahtarı |
| `APP_PASSWORD` | giriş parolan |
| `APP_SLUG` | gizli yol (`.env.local`'daki ile aynı) |
| `SESSION_SECRET` | oturum imzalama anahtarı |

Üçünün de (Production / Preview / Development) işaretli olması yeterli.

**Dikkat:** `SUPABASE_SERVICE_ROLE_KEY` veritabanının tam yetkili anahtarı.
Yalnızca buraya gir; kod içine yazma, kimseyle paylaşma.

Şimdi **Deploy**.

---

## Adım 4 — Bölgeyi Frankfurt yap (opsiyonel ama önerilir)

Supabase projen Frankfurt'ta. Vercel varsayılan olarak ABD'den sunar, bu da her
sayfa açılışına gereksiz gecikme ekler.

Vercel → proje → **Settings** → **Functions** → **Function Region** → **Frankfurt (fra1)**
→ sonra **Deployments** sekmesinden son dağıtımı **Redeploy** et.

---

## Adım 5 — Aç ve telefona ekle

Adresin: `https://<proje-adi>.vercel.app/<APP_SLUG>`

Kontrol listesi:

- [ ] Parola soruyor, doğru parolayla giriyor
- [ ] 46 kişi görünüyor, sayaçlar 14 / 1 / 3 / 28
- [ ] Türkçe karakterler bozuk değil
- [ ] Bir temas ekle → sayaçlar değişiyor
- [ ] `https://<proje-adi>.vercel.app/` (slug'sız) → 404 veriyor

**Telefona ekle:** adresi telefonun tarayıcısında aç → paylaş menüsü →
"Ana Ekrana Ekle". Uygulama gibi açılır.

---

## Sonraki değişiklikler

```bash
git add -A
git commit -m "ne değiştiğini yaz"
git push
```

Vercel push'u görünce kendiliğinden yeniden yayınlar.

---

## Sorun çıkarsa

**"Failed to fetch" / giriş çalışmıyor**
Ortam değişkenlerinden biri eksik ya da yanlış. Vercel → Settings → Environment
Variables'ı `.env.local` ile karşılaştır. Değişkeni düzelttikten sonra
**Redeploy** gerekir — kaydetmek tek başına yetmez.

**Sayfa 404 veriyor**
Adresin sonuna `/<APP_SLUG>` eklediğinden emin ol. Kök adres bilerek 404 döner.

**Kişiler boş geliyor**
`SUPABASE_SERVICE_ROLE_KEY` yanlış ya da `anon` anahtarı girilmiş. service_role
olmalı — RLS açık ve politika yok, anon anahtarla tek satır bile okunamaz.

**Build hatası**
Yerelde `npm run build` çalıştır; aynı hatayı orada da göreceksin.
