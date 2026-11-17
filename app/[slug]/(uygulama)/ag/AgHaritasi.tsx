'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { KURUM_TURU_ETIKET, type KurumTuru, type NoktaTuru } from '@/lib/ortak-nokta'

/**
 * Nöron ağı görünümlü ilişki haritası. Bağımlılıksız: kendi kuvvet
 * simülasyonu + canvas çizimi. Kişiler hücre gövdesi, ortak noktalar
 * dendrit, seçilen kişiden komşularına "sinyal" akar.
 */

export interface AgDugum {
  id: string
  ad: string
  halka: string | null
  altBaslik: string
  izler: { anahtar: string; ad: string; tur: KurumTuru; kesin: boolean }[]
}

/** öğrenme motorunun bir kişi için gördükleri (sunucuda Türkçe metne çevrilmiş). */
export interface BeyinOnerisi {
  ozellikler: string[]
  sonraki: string[]
}

export interface AgBag {
  a: string
  b: string
  noktalar: {
    /** 'beyin': ortak nokta değil, öğrenme motorunun öğrendiği bağ */
    tur: NoktaTuru | 'beyin'
    kurumTuru: KurumTuru | null
    aciklama: string
    agirlik: number
    kesin: boolean
    yakin: boolean
  }[]
}

type Grup = 'is' | 'egitim' | 'sivil' | 'sektor' | 'sehir' | 'beyin'

const GRUP_ETIKET: Record<Grup, string> = {
  is: 'İş',
  egitim: 'Okul / bölüm',
  sivil: 'Vakıf / dernek',
  sektor: 'Sektör',
  sehir: 'Şehir',
  beyin: 'Beyin (öğrenilmiş)',
}

const GRUP_RENK: Record<Grup, string> = {
  is: '#4cc9f0',
  egitim: '#80ed99',
  sivil: '#ffb703',
  sektor: '#9aa5c4',
  sehir: '#5c6a8a',
  beyin: '#f15bb5',
}

const HALKA_RENK: Record<string, string> = {
  İÇ: '#ffd166',
  ORTA: '#4cc9f0',
  DIŞ: '#c77dff',
}
const VARSAYILAN_RENK = '#8d99ae'

function turGrubu(tur: KurumTuru | null): Grup {
  if (tur === 'universite' || tur === 'okul') return 'egitim'
  if (tur === 'vakif' || tur === 'dernek' || tur === 'topluluk') return 'sivil'
  return 'is'
}

function noktaGrubu(n: AgBag['noktalar'][number]): Grup {
  if (n.tur === 'beyin') return 'beyin'
  if (n.tur === 'sektor') return 'sektor'
  if (n.tur === 'sehir') return 'sehir'
  return turGrubu(n.kurumTuru)
}

/** Kararlı sözde rastgele [0,1): aynı kişi her açılışta aynı yerden başlasın. */
function karma(metin: string): number {
  let h = 2166136261
  for (let i = 0; i < metin.length; i++) h = Math.imul(h ^ metin.charCodeAt(i), 16777619)
  return ((h >>> 0) % 100000) / 100000
}

// ------------------------------------------------------------------ çizge

interface Dugum {
  id: string
  tip: 'kisi' | 'kurum'
  ad: string
  renk: string
  x: number
  y: number
  vx: number
  vy: number
  r: number
  derece: number
  sabit: boolean
}

interface Kenar {
  i: number
  j: number
  guc: number
  renk: string
  egri: number
  aciklamalar: string[]
  olasi: boolean
}

interface Sinyal {
  k: number
  t: number
  ileri: boolean
  hiz: number
  derin: number
  parlak: number
}

interface Cizge {
  dugumler: Dugum[]
  kenarlar: Kenar[]
  komsu: Map<number, number[]>
}

function cizgeKur(
  dugumler: AgDugum[],
  baglar: AgBag[],
  gruplar: Record<Grup, boolean>,
  olasi: boolean,
  kurumDugum: boolean,
  eskiKonum: Map<string, { x: number; y: number }>,
): Cizge {
  const liste: Dugum[] = []
  const sira = new Map<string, number>()
  const ekle = (id: string, tip: Dugum['tip'], ad: string, renk: string) => {
    const eski = eskiKonum.get(id)
    const aci = karma(id) * Math.PI * 2
    const yar = 120 + karma(id + 'r') * 260
    sira.set(id, liste.length)
    liste.push({
      id,
      tip,
      ad,
      renk,
      x: eski?.x ?? Math.cos(aci) * yar,
      y: eski?.y ?? Math.sin(aci) * yar,
      vx: 0,
      vy: 0,
      r: tip === 'kurum' ? 5 : 6,
      derece: 0,
      sabit: false,
    })
  }

  for (const d of dugumler) ekle(d.id, 'kisi', d.ad, HALKA_RENK[d.halka ?? ''] ?? VARSAYILAN_RENK)

  const kenarlar: Kenar[] = []
  const kenarEkle = (a: string, b: string, guc: number, renk: string, aciklamalar: string[], olasiMi: boolean) => {
    const i = sira.get(a)
    const j = sira.get(b)
    if (i === undefined || j === undefined) return
    kenarlar.push({ i, j, guc, renk, egri: (karma(a + b) - 0.5) * 0.5, aciklamalar, olasi: olasiMi })
  }

  // kişi ↔ kişi
  for (const b of baglar) {
    const noktalar = b.noktalar.filter(
      (n) => gruplar[noktaGrubu(n)] && (olasi || n.kesin) && !(kurumDugum && n.tur === 'kurum' && !n.yakin),
    )
    if (noktalar.length === 0) continue
    const guc = noktalar.reduce((t, n) => t + n.agirlik, 0)
    const baskin = noktalar.reduce((x, y) => (y.agirlik > x.agirlik ? y : x))
    kenarEkle(
      b.a,
      b.b,
      guc,
      GRUP_RENK[noktaGrubu(baskin)],
      noktalar.map((n) => n.aciklama + (n.kesin ? '' : ' (olası)')),
      noktalar.every((n) => !n.kesin),
    )
  }

  // kurum düğümleri: en az iki kişiyi bağlayan kurumlar
  if (kurumDugum) {
    const uyeler = new Map<
      string,
      { adlar: Map<string, number>; tur: KurumTuru; kisiler: Map<string, boolean> }
    >()
    for (const d of dugumler) {
      for (const iz of d.izler) {
        if (!gruplar[turGrubu(iz.tur)] || (!olasi && !iz.kesin)) continue
        const kayit = uyeler.get(iz.anahtar) ?? { adlar: new Map(), tur: iz.tur, kisiler: new Map() }
        kayit.adlar.set(iz.ad, (kayit.adlar.get(iz.ad) ?? 0) + (iz.kesin ? 100 : 1))
        kayit.kisiler.set(d.id, iz.kesin || kayit.kisiler.get(d.id) === true)
        uyeler.set(iz.anahtar, kayit)
      }
    }
    for (const [anahtar, k] of uyeler) {
      if (k.kisiler.size < 2) continue
      const id = `kurum:${anahtar}`
      // en sık geçen yazım (geçmiş kaydındaki ad her zaman önce gelir)
      const ad = [...k.adlar].sort((x, y) => y[1] - x[1])[0][0]
      ekle(id, 'kurum', ad, GRUP_RENK[turGrubu(k.tur)])
      for (const [kisiId, kesin] of k.kisiler) {
        kenarEkle(kisiId, id, kesin ? 3 : 1.8, GRUP_RENK[turGrubu(k.tur)], [`${KURUM_TURU_ETIKET[k.tur]}: ${ad}`], !kesin)
      }
    }
  }

  const komsu = new Map<number, number[]>()
  kenarlar.forEach((k, n) => {
    liste[k.i].derece += k.guc
    liste[k.j].derece += k.guc
    komsu.set(k.i, [...(komsu.get(k.i) ?? []), n])
    komsu.set(k.j, [...(komsu.get(k.j) ?? []), n])
  })
  for (const d of liste) d.r = (d.tip === 'kurum' ? 4 : 5) + Math.sqrt(d.derece) * 1.6

  return { dugumler: liste, kenarlar, komsu }
}

/** Bir simülasyon adımı. `isi` 1'den 0'a soğur. */
function adim(c: Cizge, isi: number) {
  const D = c.dugumler
  const n = D.length
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = D[i]
      const b = D[j]
      let dx = b.x - a.x
      let dy = b.y - a.y
      let d2 = dx * dx + dy * dy
      if (d2 < 0.01) {
        dx = karma(a.id + b.id) - 0.5
        dy = 0.5 - karma(b.id + a.id)
        d2 = 0.25
      }
      if (d2 > 360000) continue
      const f = (2600 / d2) * isi
      const d = Math.sqrt(d2)
      a.vx -= (dx / d) * f
      a.vy -= (dy / d) * f
      b.vx += (dx / d) * f
      b.vy += (dy / d) * f
    }
  }
  for (const k of c.kenarlar) {
    const a = D[k.i]
    const b = D[k.j]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const d = Math.sqrt(dx * dx + dy * dy) || 1
    const hedef = Math.max(55, 150 - k.guc * 14)
    const f = (d - hedef) * 0.012 * Math.min(1.6, 0.4 + k.guc / 4) * isi
    a.vx += (dx / d) * f
    a.vy += (dy / d) * f
    b.vx -= (dx / d) * f
    b.vy -= (dy / d) * f
  }
  for (const d of D) {
    // bağsız kişiler dışta bir halkada süzülsün; bağlılar merkeze çekilsin
    const uzak = Math.sqrt(d.x * d.x + d.y * d.y) || 1
    if (d.derece === 0) {
      const f = (uzak - 340) * 0.01 * isi
      d.vx -= (d.x / uzak) * f
      d.vy -= (d.y / uzak) * f
    } else {
      d.vx -= d.x * 0.006 * isi
      d.vy -= d.y * 0.006 * isi
    }
    if (d.sabit) {
      d.vx = 0
      d.vy = 0
      continue
    }
    d.vx *= 0.82
    d.vy *= 0.82
    d.x += d.vx
    d.y += d.vy
  }
}

function egriNokta(c: Cizge, k: Kenar, t: number): [number, number] {
  const a = c.dugumler[k.i]
  const b = c.dugumler[k.j]
  const mx = (a.x + b.x) / 2 - (b.y - a.y) * k.egri
  const my = (a.y + b.y) / 2 + (b.x - a.x) * k.egri
  const u = 1 - t
  return [u * u * a.x + 2 * u * t * mx + t * t * b.x, u * u * a.y + 2 * u * t * my + t * t * b.y]
}

// ------------------------------------------------------------------ bileşen

export default function AgHaritasi({
  slug,
  dugumler,
  baglar,
  seciliBaslangic,
  beyinOnerileri = {},
  varsayimlar = [],
}: {
  slug: string
  dugumler: AgDugum[]
  baglar: AgBag[]
  seciliBaslangic: string | null
  beyinOnerileri?: Record<string, BeyinOnerisi>
  varsayimlar?: string[]
}) {
  const [gruplar, setGruplar] = useState<Record<Grup, boolean>>({
    is: true,
    egitim: true,
    sivil: true,
    sektor: true,
    sehir: false,
    beyin: true,
  })
  const [olasi, setOlasi] = useState(true)
  const [kurumDugum, setKurumDugum] = useState(true)
  const [secili, setSecili] = useState<string | null>(seciliBaslangic)
  const [arama, setArama] = useState('')

  const tuval = useRef<HTMLCanvasElement>(null)
  const kutu = useRef<HTMLDivElement>(null)
  const cizgeRef = useRef<Cizge | null>(null)
  const konumlar = useRef(new Map<string, { x: number; y: number }>())
  const kamera = useRef({ x: 0, y: 0, k: 1 })
  /** Seçilen kişiye yumuşak kaydırma hedefi; kullanıcı elle oynarsa iptal. */
  const hedefKamera = useRef<{ x: number; y: number } | null>(null)
  const isi = useRef(1)
  const sinyaller = useRef<Sinyal[]>([])
  const seciliRef = useRef<string | null>(secili)
  const uzerinde = useRef<number | null>(null)
  const ilkSigdirma = useRef(true)

  const cizge = useMemo(
    () => cizgeKur(dugumler, baglar, gruplar, olasi, kurumDugum, konumlar.current),
    [dugumler, baglar, gruplar, olasi, kurumDugum],
  )

  // yeni çizge: önceden pişir ki şekil hazır görünsün
  useEffect(() => {
    cizgeRef.current = cizge
    isi.current = 1
    sinyaller.current = []
    for (let i = 0; i < 220; i++) adim(cizge, Math.max(0.05, 1 - i / 220))
    isi.current = 0.15
    if (ilkSigdirma.current) {
      sigdir()
      ilkSigdirma.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cizge])

  // seçim değişince ateşle
  useEffect(() => {
    seciliRef.current = secili
    const c = cizgeRef.current
    if (!c || !secili) return
    const i = c.dugumler.findIndex((d) => d.id === secili)
    if (i < 0) return
    atesle(c, i, 0)
    const el = kutu.current
    if (el) {
      const kam = kamera.current
      hedefKamera.current = {
        x: el.clientWidth / 2 - c.dugumler[i].x * kam.k,
        y: el.clientHeight * 0.45 - c.dugumler[i].y * kam.k,
      }
    }
  }, [secili, cizge])

  function atesle(c: Cizge, i: number, derin: number) {
    for (const n of c.komsu.get(i) ?? []) {
      const k = c.kenarlar[n]
      sinyaller.current.push({
        k: n,
        t: 0,
        ileri: k.i === i,
        hiz: 0.012 + Math.random() * 0.01,
        derin,
        parlak: derin === 0 ? 1 : 0.5,
      })
    }
  }

  function sigdir() {
    const c = cizgeRef.current
    const el = kutu.current
    if (!c || !el || c.dugumler.length === 0) return
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
    // bağlı çekirdeğe odaklan; dış halkadaki bağsızlar çerçeveyi büyütmesin
    const bagli = c.dugumler.filter((d) => d.derece > 0)
    for (const d of bagli.length >= 3 ? bagli : c.dugumler) {
      x0 = Math.min(x0, d.x); y0 = Math.min(y0, d.y)
      x1 = Math.max(x1, d.x); y1 = Math.max(y1, d.y)
    }
    const w = el.clientWidth
    const h = el.clientHeight
    const k = Math.min(2, 0.9 * Math.min(w / (x1 - x0 + 80), h / (y1 - y0 + 80)))
    kamera.current = { k, x: w / 2 - ((x0 + x1) / 2) * k, y: h / 2 - ((y0 + y1) / 2) * k }
  }

  // çizim döngüsü
  useEffect(() => {
    const cv = tuval.current
    const el = kutu.current
    if (!cv || !el) return
    const ctx = cv.getContext('2d')
    if (!ctx) return
    let kare = 0
    let calisiyor = true

    let oncekiW = el.clientWidth
    let oncekiH = el.clientHeight
    const boyutla = () => {
      const dpr = window.devicePixelRatio || 1
      // pencere boyu değişince harita yerinde kalsın: ortayı koru
      kamera.current.x += (el.clientWidth - oncekiW) / 2
      kamera.current.y += (el.clientHeight - oncekiH) / 2
      oncekiW = el.clientWidth
      oncekiH = el.clientHeight
      cv.width = el.clientWidth * dpr
      cv.height = el.clientHeight * dpr
      cv.style.width = `${el.clientWidth}px`
      cv.style.height = `${el.clientHeight}px`
    }
    boyutla()
    const gozcu = new ResizeObserver(boyutla)
    gozcu.observe(el)

    const ciz = (zaman: number) => {
      if (!calisiyor) return
      kare = requestAnimationFrame(ciz)
      const c = cizgeRef.current
      if (!c) return
      if (isi.current > 0.02) {
        adim(c, isi.current)
        isi.current *= 0.995
      }
      for (const d of c.dugumler) konumlar.current.set(d.id, { x: d.x, y: d.y })

      const dpr = window.devicePixelRatio || 1
      const W = cv.width / dpr
      const H = cv.height / dpr
      const kam = kamera.current
      const hk = hedefKamera.current
      if (hk) {
        kam.x += (hk.x - kam.x) * 0.12
        kam.y += (hk.y - kam.y) * 0.12
        if (Math.abs(hk.x - kam.x) + Math.abs(hk.y - kam.y) < 0.5) hedefKamera.current = null
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      // arka plan: koyu, ortası hafif aydınlık
      const zemin = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.7)
      zemin.addColorStop(0, '#111a2e')
      zemin.addColorStop(1, '#05080f')
      ctx.fillStyle = zemin
      ctx.fillRect(0, 0, W, H)

      const sid = seciliRef.current
      const si = sid ? c.dugumler.findIndex((d) => d.id === sid) : -1
      const odak = new Set<number>()
      if (si >= 0) {
        odak.add(si)
        for (const n of c.komsu.get(si) ?? []) {
          odak.add(c.kenarlar[n].i)
          odak.add(c.kenarlar[n].j)
        }
      }
      const odakVar = si >= 0

      ctx.setTransform(dpr * kam.k, 0, 0, dpr * kam.k, dpr * kam.x, dpr * kam.y)
      ctx.globalCompositeOperation = 'lighter'

      // dendritler
      c.kenarlar.forEach((k, n) => {
        const a = c.dugumler[k.i]
        const b = c.dugumler[k.j]
        const ilgili = odakVar && (k.i === si || k.j === si)
        const alfa = odakVar ? (ilgili ? 0.85 : 0.035) : Math.min(0.55, 0.12 + k.guc * 0.06)
        ctx.strokeStyle = k.renk
        ctx.globalAlpha = alfa
        ctx.lineWidth = (0.5 + Math.min(k.guc, 8) * 0.28) / Math.sqrt(kam.k)
        if (k.olasi) ctx.setLineDash([4, 4])
        ctx.beginPath()
        ctx.moveTo(a.x, a.y)
        ctx.quadraticCurveTo(
          (a.x + b.x) / 2 - (b.y - a.y) * k.egri,
          (a.y + b.y) / 2 + (b.x - a.x) * k.egri,
          b.x,
          b.y,
        )
        ctx.stroke()
        ctx.setLineDash([])
        // ortam sinyalleri: güçlü bağlarda arada bir kıvılcım
        if (!odakVar && Math.random() < 0.0009 * k.guc) {
          sinyaller.current.push({ k: n, t: 0, ileri: Math.random() < 0.5, hiz: 0.008, derin: 9, parlak: 0.45 })
        }
      })

      // sinyaller
      const kalan: Sinyal[] = []
      for (const s of sinyaller.current) {
        s.t += s.hiz
        const k = c.kenarlar[s.k]
        if (!k) continue
        if (s.t >= 1) {
          // komşuya vardı: bir kat daha yay
          if (s.derin < 1) atesle(c, s.ileri ? k.j : k.i, s.derin + 1)
          continue
        }
        const [x, y] = egriNokta(c, k, s.ileri ? s.t : 1 - s.t)
        const r = (2.4 + s.parlak * 2) / Math.sqrt(kam.k)
        const parilti = ctx.createRadialGradient(x, y, 0, x, y, r * 4)
        parilti.addColorStop(0, '#ffffff')
        parilti.addColorStop(0.25, k.renk)
        parilti.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.globalAlpha = s.parlak * Math.sin(Math.PI * s.t) + 0.2
        ctx.fillStyle = parilti
        ctx.beginPath()
        ctx.arc(x, y, r * 4, 0, Math.PI * 2)
        ctx.fill()
        kalan.push(s)
      }
      sinyaller.current = kalan.slice(-400)

      // hücre gövdeleri
      c.dugumler.forEach((d, i) => {
        const soluk = odakVar && !odak.has(i)
        const nefes = 1 + Math.sin(zaman / 900 + karma(d.id) * 6) * 0.06
        const r = d.r * nefes
        const hale = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, r * 3.2)
        hale.addColorStop(0, d.renk)
        hale.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.globalAlpha = soluk ? 0.05 : d.derece === 0 ? 0.18 : 0.42
        ctx.fillStyle = hale
        ctx.beginPath()
        ctx.arc(d.x, d.y, r * 3.2, 0, Math.PI * 2)
        ctx.fill()

        ctx.globalAlpha = soluk ? 0.15 : 1
        if (d.tip === 'kurum') {
          ctx.strokeStyle = d.renk
          ctx.lineWidth = 1.6 / Math.sqrt(kam.k)
          ctx.beginPath()
          ctx.arc(d.x, d.y, r, 0, Math.PI * 2)
          ctx.stroke()
        } else {
          ctx.fillStyle = d.renk
          ctx.beginPath()
          ctx.arc(d.x, d.y, r * 0.62, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = '#ffffff'
          ctx.globalAlpha *= 0.7
          ctx.beginPath()
          ctx.arc(d.x - r * 0.15, d.y - r * 0.15, r * 0.22, 0, Math.PI * 2)
          ctx.fill()
        }
        if (i === si) {
          ctx.globalAlpha = 0.6 + Math.sin(zaman / 200) * 0.3
          ctx.strokeStyle = '#ffffff'
          ctx.lineWidth = 1.2 / kam.k
          ctx.beginPath()
          ctx.arc(d.x, d.y, r * 1.8, 0, Math.PI * 2)
          ctx.stroke()
        }
      })

      // adlar: ekran uzayında, sabit boyutta
      ctx.globalCompositeOperation = 'source-over'
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.font = '12px system-ui, sans-serif'
      ctx.textAlign = 'center'
      const esik = [...c.dugumler].map((d) => d.derece).sort((a, b) => b - a)[10] ?? 0
      c.dugumler.forEach((d, i) => {
        const goster =
          i === uzerinde.current ||
          (odakVar ? odak.has(i) : d.tip === 'kurum' || d.derece > esik || kam.k > 1.5)
        if (!goster) return
        const x = d.x * kam.k + kam.x
        const y = d.y * kam.k + kam.y + d.r * kam.k + 14
        ctx.globalAlpha = odakVar && !odak.has(i) ? 0.3 : 0.92
        ctx.fillStyle = d.tip === 'kurum' ? d.renk : '#e8ecf5'
        ctx.font = d.tip === 'kurum' ? '600 11px system-ui, sans-serif' : '12px system-ui, sans-serif'
        ctx.fillText(d.ad.length > 26 ? d.ad.slice(0, 25) + '…' : d.ad, x, y)
      })
      ctx.globalAlpha = 1
    }
    kare = requestAnimationFrame(ciz)

    return () => {
      calisiyor = false
      cancelAnimationFrame(kare)
      gozcu.disconnect()
    }
  }, [])

  // fare / dokunma
  useEffect(() => {
    const cv = tuval.current
    if (!cv) return
    let surukle: { tip: 'dugum'; i: number } | { tip: 'kaydir' } | null = null
    let bas = { x: 0, y: 0 }
    let son = { x: 0, y: 0 }
    let oynadi = false

    const dunya = (e: PointerEvent | WheelEvent) => {
      const r = cv.getBoundingClientRect()
      const kam = kamera.current
      const sx = e.clientX - r.left
      const sy = e.clientY - r.top
      return { sx, sy, x: (sx - kam.x) / kam.k, y: (sy - kam.y) / kam.k }
    }
    const bul = (x: number, y: number) => {
      const c = cizgeRef.current
      if (!c) return -1
      let en = -1
      let enD = Infinity
      c.dugumler.forEach((d, i) => {
        const dd = Math.hypot(d.x - x, d.y - y)
        if (dd < d.r + 10 / kamera.current.k && dd < enD) {
          en = i
          enD = dd
        }
      })
      return en
    }

    const asagi = (e: PointerEvent) => {
      const p = dunya(e)
      const i = bul(p.x, p.y)
      bas = son = { x: e.clientX, y: e.clientY }
      oynadi = false
      cv.setPointerCapture(e.pointerId)
      hedefKamera.current = null
      surukle = i >= 0 ? { tip: 'dugum', i } : { tip: 'kaydir' }
    }
    const hareket = (e: PointerEvent) => {
      const p = dunya(e)
      if (!surukle) {
        const i = bul(p.x, p.y)
        uzerinde.current = i >= 0 ? i : null
        cv.style.cursor = i >= 0 ? 'pointer' : 'grab'
        return
      }
      if (Math.hypot(e.clientX - bas.x, e.clientY - bas.y) > 4) oynadi = true
      if (surukle.tip === 'dugum' && oynadi) {
        const d = cizgeRef.current?.dugumler[surukle.i]
        if (d) {
          d.x = p.x
          d.y = p.y
          d.sabit = true
          isi.current = Math.max(isi.current, 0.25)
        }
      } else if (surukle.tip === 'kaydir') {
        kamera.current.x += e.clientX - son.x
        kamera.current.y += e.clientY - son.y
      }
      son = { x: e.clientX, y: e.clientY }
    }
    const yukari = () => {
      const c = cizgeRef.current
      if (surukle?.tip === 'dugum' && c) {
        c.dugumler[surukle.i].sabit = false
        if (!oynadi) setSecili(c.dugumler[surukle.i].id)
      } else if (surukle?.tip === 'kaydir' && !oynadi) {
        setSecili(null)
      }
      surukle = null
    }
    const tekerlek = (e: WheelEvent) => {
      e.preventDefault()
      hedefKamera.current = null
      const p = dunya(e)
      const kam = kamera.current
      const k = Math.min(5, Math.max(0.2, kam.k * Math.exp(-e.deltaY * 0.0015)))
      kam.x = p.sx - p.x * k
      kam.y = p.sy - p.y * k
      kam.k = k
    }

    cv.addEventListener('pointerdown', asagi)
    cv.addEventListener('pointermove', hareket)
    cv.addEventListener('pointerup', yukari)
    cv.addEventListener('pointercancel', yukari)
    cv.addEventListener('wheel', tekerlek, { passive: false })
    return () => {
      cv.removeEventListener('pointerdown', asagi)
      cv.removeEventListener('pointermove', hareket)
      cv.removeEventListener('pointerup', yukari)
      cv.removeEventListener('pointercancel', yukari)
      cv.removeEventListener('wheel', tekerlek)
    }
  }, [])

  const yakinlas = (carpan: number) => {
    const el = kutu.current
    if (!el) return
    const kam = kamera.current
    const cx = el.clientWidth / 2
    const cy = el.clientHeight / 2
    const k = Math.min(5, Math.max(0.2, kam.k * carpan))
    kam.x = cx - ((cx - kam.x) / kam.k) * k
    kam.y = cy - ((cy - kam.y) / kam.k) * k
    kam.k = k
  }

  // ------------------------------------------------------------ yan panel verisi

  const adlar = useMemo(() => new Map(cizge.dugumler.map((d) => [d.id, d])), [cizge])
  const kisiBilgi = useMemo(() => new Map(dugumler.map((d) => [d.id, d])), [dugumler])
  const seciliIndeks = secili ? cizge.dugumler.findIndex((d) => d.id === secili) : -1
  const seciliDugum = seciliIndeks >= 0 ? cizge.dugumler[seciliIndeks] : null
  const seciliBaglar =
    seciliIndeks >= 0
      ? (cizge.komsu.get(seciliIndeks) ?? [])
          .map((n) => cizge.kenarlar[n])
          .map((k) => ({ diger: cizge.dugumler[k.i === seciliIndeks ? k.j : k.i], k }))
          .sort((a, b) => b.k.guc - a.k.guc)
      : []
  const bagsiz = cizge.dugumler.filter((d) => d.tip === 'kisi' && d.derece === 0).length
  const firsatlar = baglar
    .map((b) => ({ b, guc: b.noktalar.filter((n) => n.tur !== 'sehir').reduce((t, n) => t + n.agirlik, 0) }))
    .filter((x) => x.guc >= 2.5)
    .sort((x, y) => y.guc - x.guc)
    .slice(0, 8)
  const aramaSonuc = arama.trim()
    ? dugumler.filter((d) => d.ad.toLocaleLowerCase('tr').includes(arama.trim().toLocaleLowerCase('tr'))).slice(0, 6)
    : []

  return (
    <div className="yigin">
      {/* süzgeçler */}
      <div className="satir" style={{ flexWrap: 'wrap', gap: 8 }}>
        {(Object.keys(GRUP_ETIKET) as Grup[]).map((g) => (
          <label key={g} className="rozet rozet-notr" style={{ cursor: 'pointer', borderColor: GRUP_RENK[g] }}>
            <input
              type="checkbox"
              checked={gruplar[g]}
              onChange={(e) => setGruplar({ ...gruplar, [g]: e.target.checked })}
              style={{ marginRight: 6 }}
            />
            <span style={{ color: GRUP_RENK[g], marginRight: 4 }}>●</span>
            {GRUP_ETIKET[g]}
          </label>
        ))}
        <label className="rozet rozet-notr" style={{ cursor: 'pointer' }}>
          <input type="checkbox" checked={kurumDugum} onChange={(e) => setKurumDugum(e.target.checked)} style={{ marginRight: 6 }} />
          Kurumları göster
        </label>
        <label className="rozet rozet-notr" style={{ cursor: 'pointer' }}>
          <input type="checkbox" checked={olasi} onChange={(e) => setOlasi(e.target.checked)} style={{ marginRight: 6 }} />
          Olası bağlar (kesikli)
        </label>
      </div>

      <div
        ref={kutu}
        style={{
          position: 'relative',
          height: '68vh',
          minHeight: 420,
          borderRadius: 14,
          overflow: 'hidden',
          background: '#05080f',
          touchAction: 'none',
        }}
      >
        <canvas ref={tuval} aria-label="İlişki ağı haritası" />
        <div style={{ position: 'absolute', top: 10, left: 10, right: 10, display: 'flex', gap: 6 }}>
          <div style={{ position: 'relative', flex: '0 1 240px' }}>
            <input
              value={arama}
              onChange={(e) => setArama(e.target.value)}
              placeholder="Kişi ara…"
              aria-label="Haritada kişi ara"
              style={{ width: '100%', background: 'rgba(10,16,30,0.85)', color: '#e8ecf5', borderColor: '#2a3550' }}
            />
            {aramaSonuc.length > 0 ? (
              <ul
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  margin: 0,
                  padding: 4,
                  listStyle: 'none',
                  background: 'rgba(10,16,30,0.95)',
                  border: '1px solid #2a3550',
                  borderRadius: 8,
                  zIndex: 2,
                }}
              >
                {aramaSonuc.map((d) => (
                  <li key={d.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSecili(d.id)
                        setArama('')
                      }}
                      style={{ all: 'unset', cursor: 'pointer', display: 'block', padding: '6px 8px', color: '#e8ecf5' }}
                    >
                      {d.ad}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <span style={{ flex: 1 }} />
          {[
            ['+', () => yakinlas(1.3), 'Yakınlaş'],
            ['−', () => yakinlas(1 / 1.3), 'Uzaklaş'],
            ['⤢', sigdir, 'Tümünü sığdır'],
          ].map(([e, f, t]) => (
            <button
              key={e as string}
              type="button"
              className="btn btn-kucuk"
              onClick={f as () => void}
              title={t as string}
              aria-label={t as string}
              style={{ background: 'rgba(10,16,30,0.85)', color: '#e8ecf5', borderColor: '#2a3550' }}
            >
              {e as string}
            </button>
          ))}
        </div>
        <div
          style={{
            position: 'absolute',
            bottom: 8,
            left: 10,
            fontSize: 11,
            color: '#8d99ae',
            display: 'flex',
            gap: 10,
            flexWrap: 'wrap',
          }}
        >
          {Object.entries(HALKA_RENK).map(([h, r]) => (
            <span key={h}>
              <span style={{ color: r }}>●</span> {h}
            </span>
          ))}
          <span>○ kurum</span>
          <span>
            {cizge.dugumler.filter((d) => d.tip === 'kisi').length} kişi · {cizge.kenarlar.length} bağ
          </span>
        </div>
      </div>

      {/* yan bilgi */}
      {seciliDugum ? (
        <section className="kart">
          <div className="kart-baslik">
            <h2>{seciliDugum.ad}</h2>
            <span className="aralik" />
            {seciliDugum.tip === 'kisi' ? (
              <Link href={`/${slug}/kisiler/${seciliDugum.id}`} className="btn btn-kucuk">
                Profili aç
              </Link>
            ) : null}
            <button type="button" className="btn btn-kucuk" onClick={() => setSecili(null)}>
              Kapat
            </button>
          </div>
          {seciliDugum.tip === 'kisi' && kisiBilgi.get(seciliDugum.id)?.altBaslik ? (
            <p className="soluk" style={{ marginTop: 0 }}>{kisiBilgi.get(seciliDugum.id)!.altBaslik}</p>
          ) : null}
          {seciliBaglar.length === 0 ? (
            <p className="bos-durum">
              Bu kişinin henüz görünen bir ortak noktası yok. Profilinden okul, bölüm, şirket ya
              da vakıf ekledikçe bağlanacak.
            </p>
          ) : (
            <ul className="cizelge">
              {seciliBaglar.map(({ diger, k }) => (
                <li key={diger.id}>
                  <div className="satir">
                    <span style={{ color: k.renk }}>●</span>
                    <button
                      type="button"
                      onClick={() => setSecili(diger.id)}
                      style={{ all: 'unset', cursor: 'pointer', fontWeight: 600 }}
                    >
                      {diger.tip === 'kurum' ? `○ ${diger.ad}` : diger.ad}
                    </button>
                    <span className="aralik" />
                    <span className="soluk">güç {Math.round(k.guc * 10) / 10}</span>
                  </div>
                  <p className="soluk" style={{ margin: '2px 0 0' }}>{k.aciklamalar.join(' · ')}</p>
                </li>
              ))}
            </ul>
          )}
          {seciliDugum.tip === 'kisi' && beyinOnerileri[seciliDugum.id] ? (
            <div style={{ marginTop: 12, borderTop: '1px solid var(--kenar)', paddingTop: 8 }}>
              <div className="etiket" style={{ color: GRUP_RENK.beyin }}>
                🧠 Beynin gördükleri
              </div>
              {beyinOnerileri[seciliDugum.id].ozellikler.length ? (
                <p style={{ margin: '4px 0 0' }}>
                  <span className="soluk">Birlikte görülen: </span>
                  {beyinOnerileri[seciliDugum.id].ozellikler.join(' · ')}
                </p>
              ) : null}
              {beyinOnerileri[seciliDugum.id].sonraki.length ? (
                <p style={{ margin: '4px 0 0' }}>
                  <span className="soluk">Sırada genelde: </span>
                  {beyinOnerileri[seciliDugum.id].sonraki.join(' · ')}
                </p>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : (
        <section className="kart">
          <div className="kart-baslik">
            <h2>Tanıştırma fırsatları</h2>
            <span className="aralik" />
            <span className="soluk">ortak noktası güçlü çiftler</span>
          </div>
          {firsatlar.length === 0 ? (
            <p className="bos-durum">Henüz güçlü bir ortak nokta yok. Kişilere geçmiş ekledikçe çıkacak.</p>
          ) : (
            <ul className="cizelge">
              {firsatlar.map(({ b, guc }) => (
                <li key={b.a + b.b}>
                  <div className="satir">
                    <button type="button" onClick={() => setSecili(b.a)} style={{ all: 'unset', cursor: 'pointer', fontWeight: 600 }}>
                      {adlar.get(b.a)?.ad ?? kisiBilgi.get(b.a)?.ad}
                    </button>
                    <span className="soluk">↔</span>
                    <button type="button" onClick={() => setSecili(b.b)} style={{ all: 'unset', cursor: 'pointer', fontWeight: 600 }}>
                      {adlar.get(b.b)?.ad ?? kisiBilgi.get(b.b)?.ad}
                    </button>
                    <span className="aralik" />
                    <span className="soluk">güç {Math.round(guc * 10) / 10}</span>
                  </div>
                  <p className="soluk" style={{ margin: '2px 0 0' }}>
                    {b.noktalar
                      .filter((n) => n.tur !== 'sehir')
                      .map((n) => n.aciklama + (n.kesin ? '' : ' (olası)'))
                      .join(' · ')}
                  </p>
                </li>
              ))}
            </ul>
          )}
          {bagsiz > 0 ? (
            <p className="soluk" style={{ marginBottom: 0 }}>
              {bagsiz} kişi henüz kimseyle bağlı değil (haritanın dış halkasında). Profillerine
              geçmiş ekledikçe ağa katılacaklar.
            </p>
          ) : null}
          {varsayimlar.length ? (
            <details style={{ marginTop: 12 }}>
              <summary style={{ cursor: 'pointer', color: GRUP_RENK.beyin }}>
                🧠 Beynin varsayımları ({varsayimlar.length}): henüz gözlenmemiş, sınanan ilişkiler
              </summary>
              <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                {varsayimlar.map((v) => (
                  <li key={v} className="soluk">
                    {v}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </section>
      )}
    </div>
  )
}
