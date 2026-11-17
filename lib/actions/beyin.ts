'use server'

import { revalidatePath } from 'next/cache'
import { oturumZorunlu, slug } from '../auth'
import { beyinCalistir, type BeyinSonucu } from '../beyin-tetik'

export type BeyinGuncellemeSonucu = BeyinSonucu

/** Ağ sayfasındaki "Beyni güncelle" tuşu. */
export async function beyniGuncelle(): Promise<BeyinGuncellemeSonucu> {
  await oturumZorunlu()
  const sonuc = await beyinCalistir()
  if (!sonuc.hata) {
    const kok = `/${slug()}`
    revalidatePath(`${kok}/ag`)
    revalidatePath(`${kok}/kisiler`, 'layout')
  }
  return sonuc
}
