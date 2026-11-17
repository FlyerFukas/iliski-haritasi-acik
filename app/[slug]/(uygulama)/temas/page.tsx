import { bugun } from '@/lib/hesaplama'
import { secilebilirKisiler } from '@/lib/sorgular'
import TemasFormu from './TemasFormu'

export const dynamic = 'force-dynamic'

export default async function TemasSayfasi({
  searchParams,
}: {
  searchParams: Promise<{ kisi?: string }>
}) {
  const { kisi: onSecili } = await searchParams
  const kisiler = await secilebilirKisiler()

  // En acil olan en üstte: geciken kişiler listenin başında dursun ki
  // arama yazmadan tek dokunuşla seçilebilsinler.
  const sirali = [...kisiler].sort((a, b) => {
    if (a.kalanGun === null && b.kalanGun === null) return 0
    if (a.kalanGun === null) return 1
    if (b.kalanGun === null) return -1
    return a.kalanGun - b.kalanGun
  })

  return (
    <div className="yigin">
      <h1>Temas ekle</h1>
      <TemasFormu
        kisiler={sirali}
        bugun={bugun()}
        secili={sirali.find((k) => k.id === onSecili)}
      />
    </div>
  )
}
