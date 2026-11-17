/**
 * PWA ikonlarını üretir (public/ altına PNG).
 *
 *   npm run simge
 *
 * Bağımlılık yok: PNG'yi elle kodluyoruz (IHDR + IDAT + IEND, zlib deflate).
 * Görsel bir ağ motifi — merkezde bir düğüm, çevresinde bağlı düğümler:
 * uygulamanın yaptığı işin resmi.
 */

import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const KOK = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const ZEMIN: [number, number, number] = [0x17, 0x1b, 0x21] // --yuzey (koyu)
const VURGU: [number, number, number] = [0x58, 0xa6, 0xff] // --vurgu
const SICAK: [number, number, number] = [0xff, 0xa6, 0x57]

function crc32(veri: Buffer): number {
  let c: number
  const tablo: number[] = []
  for (let n = 0; n < 256; n++) {
    c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    tablo[n] = c >>> 0
  }
  let crc = 0xffffffff
  for (const b of veri) crc = tablo[(crc ^ b) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function parca(tip: string, veri: Buffer): Buffer {
  const uzunluk = Buffer.alloc(4)
  uzunluk.writeUInt32BE(veri.length)
  const govde = Buffer.concat([Buffer.from(tip, 'ascii'), veri])
  const kontrol = Buffer.alloc(4)
  kontrol.writeUInt32BE(crc32(govde))
  return Buffer.concat([uzunluk, govde, kontrol])
}

function png(boyut: number, pikselYaz: (x: number, y: number) => [number, number, number]): Buffer {
  // her satır: 1 filtre baytı (0) + boyut * 3 bayt RGB
  const ham = Buffer.alloc(boyut * (1 + boyut * 3))
  let i = 0
  for (let y = 0; y < boyut; y++) {
    ham[i++] = 0
    for (let x = 0; x < boyut; x++) {
      const [r, g, b] = pikselYaz(x, y)
      ham[i++] = r
      ham[i++] = g
      ham[i++] = b
    }
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(boyut, 0)
  ihdr.writeUInt32BE(boyut, 4)
  ihdr[8] = 8 // bit derinliği
  ihdr[9] = 2 // renk tipi: truecolor
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    parca('IHDR', ihdr),
    parca('IDAT', deflateSync(ham, { level: 9 })),
    parca('IEND', Buffer.alloc(0)),
  ])
}

/** Ağ motifi: merkez düğüm + 5 uydu, aralarında çizgiler. */
function motif(boyut: number) {
  const merkez = boyut / 2
  const yaricap = boyut * 0.3
  const dugumR = boyut * 0.075
  const merkezR = boyut * 0.105
  const cizgiKalinlik = Math.max(1.5, boyut * 0.018)

  const uydular = Array.from({ length: 5 }, (_, n) => {
    const aci = (Math.PI * 2 * n) / 5 - Math.PI / 2
    return { x: merkez + Math.cos(aci) * yaricap, y: merkez + Math.sin(aci) * yaricap }
  })

  const noktaCizgiUzakligi = (px: number, py: number, ax: number, ay: number, bx: number, by: number) => {
    const dx = bx - ax
    const dy = by - ay
    const uzunluk2 = dx * dx + dy * dy
    let t = uzunluk2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / uzunluk2
    t = Math.max(0, Math.min(1, t))
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
  }

  return (x: number, y: number): [number, number, number] => {
    const px = x + 0.5
    const py = y + 0.5

    // köşeleri hafif yuvarla (maskable ikon için güvenli alan içinde kalıyor)
    for (const u of uydular) {
      if (Math.hypot(px - u.x, py - u.y) <= dugumR) return VURGU
    }
    if (Math.hypot(px - merkez, py - merkez) <= merkezR) return SICAK

    for (const u of uydular) {
      if (noktaCizgiUzakligi(px, py, merkez, merkez, u.x, u.y) <= cizgiKalinlik) {
        return [0x3d, 0x6b, 0xa8]
      }
    }
    return ZEMIN
  }
}

for (const boyut of [192, 512, 180]) {
  const ad = boyut === 180 ? 'apple-touch-icon.png' : `icon-${boyut}.png`
  const tampon = png(boyut, motif(boyut))
  writeFileSync(resolve(KOK, 'public', ad), tampon)
  console.log(`✓ public/${ad}  ${boyut}×${boyut}  ${tampon.length} bayt`)
}
