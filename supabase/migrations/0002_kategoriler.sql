-- Kategorileri düzenlenebilir yap (Ayarlar ekranından ekle/çıkar).
-- Supabase SQL Editor'e yapıştırıp çalıştır. Tekrar çalıştırılabilir.

alter table public.ayarlar
  add column if not exists kategoriler text[] not null default array[
    'Kişisel',
    'Müşteriler',
    'Potansiyel Müşteriler',
    'Önemli İş Arkadaşları',
    'Tanışmak İstediklerim'
  ];

comment on column public.ayarlar.kategoriler is
  'Kişi kategorileri. Ayarlar ekranından düzenlenir; kod içinde sabit değildir.';

-- Kişilerdeki kategori kısıtı kaldırılıyor: artık geçerli değerler kod değil
-- ayarlar tablosu belirliyor. Kısıt kalsaydı yeni kategori eklenemezdi.
alter table public.kisiler
  drop constraint if exists kisiler_kategori_gecerli;

-- Halihazırda kullanılan ama listede olmayan kategori varsa listeye ekle,
-- böylece hiçbir kişinin kategorisi görünmez olmaz.
update public.ayarlar
set kategoriler = (
  select array(
    select distinct k from (
      select unnest(ayarlar.kategoriler) as k
      union
      select distinct kategori from public.kisiler where kategori is not null
    ) t
    order by k
  )
)
where tek_satir;
