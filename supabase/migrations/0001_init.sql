-- İlişki Haritası — başlangıç şeması (SPEC §3)
-- Supabase SQL Editor'e yapıştırıp çalıştır. Tekrar çalıştırılabilir (idempotent).

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- kisiler

create table if not exists public.kisiler (
  id                  uuid primary key default gen_random_uuid(),
  ad                  text not null unique,
  halka               text,
  kategori            text,
  frekans             int,
  ozel_aralik_gun     int,
  rol                 text,
  sirket              text,
  sektor              text,
  sehir               text,
  telefon             text,
  eposta              text,
  profil_baglantisi   text,
  kisisel_detay       text,
  yapilacak_hamle     text,
  notlar              text,
  arsiv               boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint kisiler_halka_gecerli
    check (halka is null or halka in ('İÇ', 'ORTA', 'DIŞ')),
  constraint kisiler_frekans_gecerli
    check (frekans is null or frekans in (1, 2, 3)),
  constraint kisiler_ozel_aralik_pozitif
    check (ozel_aralik_gun is null or ozel_aralik_gun > 0)
);

comment on column public.kisiler.kisisel_detay is
  'Ferrazzi sisteminin kalbi: iş dışı bilgi (hobi, memleket, çocuk).';
comment on column public.kisiler.arsiv is
  'Silme yok, arşivleme var. Hesaplamalar arşivlenmemişleri sayar.';

create index if not exists kisiler_arsiv_idx    on public.kisiler (arsiv);
create index if not exists kisiler_kategori_idx on public.kisiler (kategori);
create index if not exists kisiler_halka_idx    on public.kisiler (halka);

-- ---------------------------------------------------------------- temaslar
-- APPEND-ONLY. Kayıt silinmez, değiştirilmez. Hata varsa iptal = true.

create table if not exists public.temaslar (
  id                  uuid primary key default gen_random_uuid(),
  kisi_id             uuid not null references public.kisiler (id) on delete restrict,
  tarih               date not null,
  yontem              text,
  ofis_disi_yuz_yuze  boolean not null default false,
  "not"               text,
  iptal               boolean not null default false,
  created_at          timestamptz not null default now(),

  constraint temaslar_yontem_gecerli
    check (yontem is null or yontem in
      ('E-posta', 'Telefon', 'Yüz yüze', 'Mesaj', 'Sosyal medya', 'Diğer'))
);

comment on table public.temaslar is
  'Append-only. Silme/güncelleme yok; yanlış giriş iptal=true ile işaretlenir.';

create index if not exists temaslar_kisi_idx       on public.temaslar (kisi_id);
create index if not exists temaslar_kisi_tarih_idx on public.temaslar (kisi_id, tarih desc);
create index if not exists temaslar_tarih_idx      on public.temaslar (tarih desc);

-- Bilerek TEKİLLİK KISITI YOK: aynı kişiyle aynı gün iki kez görüşmek gerçek bir
-- senaryodur ve temas ekleme akışını hata ile durdurmamalı (CLAUDE.md kural 3).
-- Seed'in tekrar çalıştırılabilirliği scripts/seed.ts içinde imza karşılaştırmasıyla
-- sağlanır.

-- ---------------------------------------------------------------- hedefler

create table if not exists public.hedefler (
  id                uuid primary key default gen_random_uuid(),
  hedef_isim        text not null,
  sirket_rol        text,
  neden             text,
  ortak_baglanti    text,
  yaklasim_plani    text,
  durum             text not null default 'Araştırma',
  "not"             text,
  tasindi_kisi_id   uuid references public.kisiler (id) on delete set null,
  created_at        timestamptz not null default now(),

  constraint hedefler_durum_gecerli
    check (durum in ('Araştırma', 'İlk Temas Yapıldı', 'Görüşme Ayarlandı', 'Tanıştım'))
);

comment on column public.hedefler.tasindi_kisi_id is
  'Hedef "Tanıştım" olup kisiler tablosuna taşınınca oluşan kaydın id''si.';

create unique index if not exists hedefler_isim_tekil_idx on public.hedefler (hedef_isim);

-- ---------------------------------------------------------------- ayarlar
-- Tek satır. tek_satir = true kısıtı ikinci satırı imkânsız kılar.

create table if not exists public.ayarlar (
  tek_satir       boolean primary key default true,
  frekans_1_gun   int not null default 14,
  frekans_2_gun   int not null default 30,
  frekans_3_gun   int not null default 60,
  updated_at      timestamptz not null default now(),

  constraint ayarlar_tek_satir check (tek_satir),
  constraint ayarlar_gun_pozitif
    check (frekans_1_gun > 0 and frekans_2_gun > 0 and frekans_3_gun > 0)
);

insert into public.ayarlar (tek_satir) values (true) on conflict do nothing;

-- ------------------------------------------------------- degisiklik_gecmisi
-- Kişi alanı her güncellendiğinde eski değer buraya yazılır. ESKİ BİLGİ KAYBOLMAZ.

create table if not exists public.degisiklik_gecmisi (
  id                uuid primary key default gen_random_uuid(),
  tablo             text not null,
  kayit_id          uuid not null,
  alan              text not null,
  eski_deger        text,
  yeni_deger        text,
  degisiklik_zamani timestamptz not null default now()
);

create index if not exists degisiklik_kayit_idx
  on public.degisiklik_gecmisi (tablo, kayit_id, degisiklik_zamani desc);

-- ---------------------------------------------------------------- updated_at

create or replace function public.dokun_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists kisiler_updated_at on public.kisiler;
create trigger kisiler_updated_at
  before update on public.kisiler
  for each row execute function public.dokun_updated_at();

drop trigger if exists ayarlar_updated_at on public.ayarlar;
create trigger ayarlar_updated_at
  before update on public.ayarlar
  for each row execute function public.dokun_updated_at();

-- ---------------------------------------------------------------- RLS
-- RLS açık, POLİTİKA YOK. Sonuç: anon/authenticated anahtarlarıyla hiçbir satır
-- okunamaz/yazılamaz. Yalnızca service_role (sunucu tarafı) erişir — SPEC §6.

alter table public.kisiler            enable row level security;
alter table public.temaslar           enable row level security;
alter table public.hedefler           enable row level security;
alter table public.ayarlar            enable row level security;
alter table public.degisiklik_gecmisi enable row level security;

revoke all on public.kisiler,
              public.temaslar,
              public.hedefler,
              public.ayarlar,
              public.degisiklik_gecmisi
  from anon, authenticated;
