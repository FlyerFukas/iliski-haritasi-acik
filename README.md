# İlişki Haritası

Keith Ferrazzi'nin *Never Eat Alone* kitabındaki "çınlama" yöntemini (tanıdıklarınla belirli aralıklarla temas kurma) Excel tablosundan web uygulamasına taşıyan kişisel ilişki takip sistemi.

*A personal relationship tracker (single-user CRM) built on Ferrazzi's "pinging" method. Turkish UI.*

## Ne yapıyor

- Her kişiye bir halka (iç, orta, dış) ve temas sıklığı verirsin. Uygulama bugün kimi araman gerektiğini kendisi hesaplar.
- Temas kaydı üç dokunuşta biter, telefonda tek elle kullanılır.
- **Ağ haritası:** kişileri ortak iş yeri, okul, sektör ve şehir üzerinden bağlayan etkileşimli grafik.
- **Tanışmak istediklerim:** hedef kişileri takip eder, tanışınca tek tuşla kişilere taşır.
- LinkedIn `Connections.csv` ve profil PDF'inden kişi aktarımı.
- Excel, CSV ve JSON dışa aktarım; günlük yedek ve yedek doğrulama betikleri.
- Kişi bilgisi değişince eski hali silinmez, değişiklik geçmişi tutulur.

## Yığın

Next.js 15 (App Router) · React 19 · TypeScript · Supabase (Postgres) · Vercel

Erişim tek kullanıcılıdır: tahmin edilemez gizli bir yol (`APP_SLUG`) ve parola. Oturum çerezi imzalı ve `httpOnly`.

## Kurulum

```bash
npm install
cp .env.local.example .env.local   # değerleri doldur
# supabase/migrations/ altındaki SQL dosyalarını sırayla çalıştır
npm run seed                       # data/seed.json içindeki örnek kişileri yükler
npm run dev
```

Uygulama `http://localhost:3000/<APP_SLUG>` adresinde açılır. Kök adres bilerek 404 döner.

Ayrıntılı kurulum `BASLA.md`, yayına alma `YAYINLA.md`, tasarım şartnamesi `SPEC.md` içinde.

## Notlar

- `data/seed.json` tamamen kurgusal kişilerden oluşur. Gerçek kullanımın verisi bu depoda yoktur.
- Ağ sayfasındaki "öğrenilmiş bağ" önerileri ayrı, kapalı kaynak bir öğrenme motorundan gelir. Motor bu depoda yer almaz; o bölüm boş görünür, uygulamanın geri kalanı çalışır.
- `erisim/` klasörü arayüzün bilişsel yük ve bilgi kokusu denetim kitidir ([Erişilebilirlik](https://github.com/FlyerFukas/erisilebilirlik)).

## Lisans

[PolyForm Noncommercial 1.0.0](LICENSE). Kişisel ve ticari olmayan kullanım serbest.
