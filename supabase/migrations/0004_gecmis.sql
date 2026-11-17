-- K-04: Kişilerin geçmişi (şirket, üniversite/bölüm, okul, vakıf, dernek, ...)
-- Supabase SQL Editor'e yapıştırıp çalıştır. Tekrar çalıştırılabilir.
-- Mevcut hiçbir tabloya ve sütuna dokunmaz; yalnızca yeni tablo ekler.

-- ---------------------------------------------------------------- kurumlar
-- Bir kurum bir kez yazılır. `anahtar` Türkçe duyarsız normalize ad
-- ("TEV", "Tev" → "tev"); aynı kurumun farklı yazımları tek satırda birleşir.
create table if not exists public.kurumlar (
  id          uuid primary key default gen_random_uuid(),
  ad          text not null,
  anahtar     text not null unique,
  tur         text not null default 'diger',
  sektor      text,
  sehir       text,
  created_at  timestamptz not null default now(),

  constraint kurumlar_tur_gecerli check (
    tur in ('sirket', 'universite', 'okul', 'vakif', 'dernek', 'topluluk', 'kamu', 'diger')
  )
);

-- ---------------------------------------------------------------- kisi_gecmisi
-- Bir kişinin bir kurumla bağı: çalıştığı şirket, okuduğu bölüm, üyesi
-- olduğu vakıf... Silinmez: kaldırılan kayıt `arsiv = true` olur.
create table if not exists public.kisi_gecmisi (
  id             uuid primary key default gen_random_uuid(),
  kisi_id        uuid not null references public.kisiler (id) on delete restrict,
  kurum_id       uuid not null references public.kurumlar (id) on delete restrict,
  alan           text,          -- bölüm / unvan / görev
  baslangic_yil  int,
  bitis_yil      int,
  guncel         boolean not null default false,
  "not"          text,
  arsiv          boolean not null default false,
  created_at     timestamptz not null default now(),

  constraint kisi_gecmisi_yil_gecerli check (
    (baslangic_yil is null or baslangic_yil between 1900 and 2100)
    and (bitis_yil is null or bitis_yil between 1900 and 2100)
    and (baslangic_yil is null or bitis_yil is null or bitis_yil >= baslangic_yil)
  )
);

create index if not exists kisi_gecmisi_kisi_idx  on public.kisi_gecmisi (kisi_id);
create index if not exists kisi_gecmisi_kurum_idx on public.kisi_gecmisi (kurum_id);

-- Uygulama service_role ile bağlanır; diğer tablolarla aynı şekilde RLS açık,
-- politika yok (anon anahtarla hiçbir şey okunamaz).
alter table public.kurumlar     enable row level security;
alter table public.kisi_gecmisi enable row level security;
