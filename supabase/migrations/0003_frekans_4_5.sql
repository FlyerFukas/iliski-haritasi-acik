-- Frekans 4 (90 gün) ve 5 (120 gün) ekle.
-- Supabase SQL Editor'e yapıştırıp çalıştır. Tekrar çalıştırılabilir.

alter table public.ayarlar
  add column if not exists frekans_4_gun int not null default 90,
  add column if not exists frekans_5_gun int not null default 120;

-- Gün sayısı kısıtını yeni sütunları da kapsayacak şekilde yenile
alter table public.ayarlar drop constraint if exists ayarlar_gun_pozitif;
alter table public.ayarlar
  add constraint ayarlar_gun_pozitif check (
    frekans_1_gun > 0 and frekans_2_gun > 0 and frekans_3_gun > 0
    and frekans_4_gun > 0 and frekans_5_gun > 0
  );

-- Kişilere 4 ve 5 atanabilsin: eski kısıt yalnızca 1-2-3'e izin veriyordu
alter table public.kisiler drop constraint if exists kisiler_frekans_gecerli;
alter table public.kisiler
  add constraint kisiler_frekans_gecerli
    check (frekans is null or frekans between 1 and 5);
