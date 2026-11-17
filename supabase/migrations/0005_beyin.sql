-- öğrenme motoru entegrasyonu: beynin sorgu sonuçları.
-- Supabase SQL Editor'e yapıştırıp çalıştır. Tekrar çalıştırılabilir.
-- Beyin yerelde (beyin/durum/beyin.json) öğrenir; uygulama yalnız bu tabloyu okur.
--   anahtar = 'genel'        → özet, arkadaş yolunu öngörenler, varsayımlar, son fark raporu
--   anahtar = 'kisi:<uuid>'  → o kişiyle ilişkili kişiler/özellikler, sonraki adım, gerekçeler

create table if not exists public.beyin_cikti (
  anahtar       text primary key,
  veri          jsonb not null,
  guncellendi   timestamptz not null default now()
);

alter table public.beyin_cikti enable row level security;
