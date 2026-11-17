'use server'

import { redirect } from 'next/navigation'
import { oturumAc, oturumKapat, parolaDogru, slug } from '../auth'

export interface GirisDurumu {
  hata?: string
}

/**
 * Parola ile giriş.
 *
 * Yanlış parolada kasıtlı gecikme var: uygulama internete açık bir adreste
 * duruyor ve tek parolayla korunuyor. Gecikme, deneme hızını insan hızına
 * indirir. (Asıl koruma yine de tahmin edilemez slug.)
 */
export async function girisYap(
  _onceki: GirisDurumu,
  formData: FormData,
): Promise<GirisDurumu> {
  const parola = String(formData.get('parola') ?? '')

  if (!parola) return { hata: 'Parola gerekli.' }

  if (!parolaDogru(parola)) {
    await new Promise((coz) => setTimeout(coz, 600))
    return { hata: 'Parola yanlış.' }
  }

  await oturumAc()
  redirect(`/${slug()}`)
}

export async function cikisYap(): Promise<void> {
  await oturumKapat()
  redirect(`/${slug()}/giris`)
}
