<script setup lang="ts">
// Landing (SPEC M2.5 P2, restyled 2026-10-11 after trysundrop.app). A white
// page with big centred headlines; shapes, recap stickers and mail bubbles
// burst out of the middle of the hero (towards the viewer, in 3D) and pop out
// around the closing call to action. Each
// section sits its picture on a big coloured shape: the playing example on
// its business's colour, the three steps on the page's own palette.
// Server-rendered, CSS motion only, no third-party scripts.
import { ArrowRight, ChevronDown } from '@lucide/vue'
import { usePreferredReducedMotion } from '@vueuse/core'
import type LandingPlayer from '~/components/landing/LandingPlayer.vue'
import { blobFrames, type ShapeKind } from '~/lib/shapes'
import { EXAMPLES, withDemoButton } from '~/data/examples'
import { readableOn } from '#shared/utils/color'
import { CONTACT_EMAIL, LEGAL_NAME } from '~/data/legal'
import { FAQS, INCLUDES, LANDING_AUDIENCE, LANDING_DESCRIPTION, LANDING_LEDE, LANDING_TITLE, PRICING_LEAD, STEPS, TIERS } from '~/data/landing'

definePageMeta({ layout: false })

const origin = useRequestURL().origin
const examples = EXAMPLES.map(e => ({ ...e, payload: withDemoButton(e.payload, origin) }))

const active = ref(0)
const current = computed(() => examples[active.value]!)
// Each example sits on its own shape, in its business's colour.
const exampleShapes: { kind: ShapeKind, r: number }[] = [
  { kind: 'clover', r: -14 },
  { kind: 'poppy', r: 8 },
  { kind: 'marigold', r: 12 },
  { kind: 'scallop', r: 0 },
  { kind: 'daisy', r: 6 },
]

const title = LANDING_TITLE
const description = LANDING_DESCRIPTION
// Search and link previews (SPEC M2.11): the page is prerendered, so every
// URL names the public site, not the host that built it.
const canonical = useCanonical('/')
const ogImage = siteHref('/og.png')
const ogImageAlt = 'Highreel: give every customer their year\'s highlight reel. From $99 per campaign.'
useSeoMeta({
  title,
  description,
  ogTitle: 'Give every customer their year\'s highlight reel.',
  ogDescription: description,
  ogSiteName: 'Highreel',
  ogLocale: 'en_US',
  ogImage,
  ogImageWidth: 1200,
  ogImageHeight: 630,
  ogImageType: 'image/png',
  ogImageAlt,
  ogType: 'website',
  twitterCard: 'summary_large_image',
  twitterImageAlt: ogImageAlt,
})
useHead({
  meta: [{ name: 'theme-color', content: '#FFFFFF' }],
  bodyAttrs: { class: 'landing-page' },
})
// Cloudflare Web Analytics, on the live site once the page is idle.
usePublicAnalytics()

const motion = usePreferredReducedMotion()
const reduced = computed(() => motion.value === 'reduce')

// --- Decorations -----------------------------------------------------------------
// The page's own palette; recaps bring their business's colours.
const C = { green: '#00C28A', marigold: '#FFB43A', poppy: '#FF5B42', blue: '#4560FF', violet: '#8F66F6' }

interface Spot {
  /** centre, in % of the section */
  x: number
  y: number
  r?: number
  /** on phones: [x %, y %, size px]; without it the piece hides on phones */
  m?: [number, number, number?]
}
interface ShapeSpot extends Spot { kind: ShapeKind, color: string, s: number }

/** Position, tilt and pop-out vector (from the middle outwards) for one piece. */
function spot(p: Spot & { s?: number }, i: number, from = 150) {
  return {
    '--x': `${p.x}%`,
    '--y': `${p.y}%`,
    '--r': `${p.r ?? 0}deg`,
    '--dx': `${Math.round((50 - p.x) * 2.2)}px`,
    '--dy': `${Math.round((50 - p.y) * 1.6)}px`,
    '--d': `${from + i * 45}ms`,
    ...(p.s ? { '--s': `${p.s}px` } : {}),
    ...(p.m ? { '--mx': `${p.m[0]}%`, '--my': `${p.m[1]}%` } : {}),
    ...(p.m?.[2] ? { '--ms': `${p.m[2]}px` } : {}),
  }
}

/** A seeded random in [0, 1) (mulberry32): integer maths only, so the server and every browser get the same numbers. */
function seeded(seed: number) {
  let t = seed >>> 0
  return () => {
    t = (t + 0x6D2B79F5) >>> 0
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

// The hero's opening burst (owner, 2026-10-12: "you're in space, something
// explodes and the debris comes towards you, out to your peripherals"). Each
// piece starts deep in the scene behind the headline, where perspective draws
// it small and near the middle, then rushes towards the viewer tumbling,
// overshoots a touch and settles where it rests. Depth, tumble, duration and
// delay are seeded per piece, so every load looks the same.
function burst(p: Spot, i: number) {
  const rnd = seeded(p.x * 1009 + p.y * 7 + i * 7919)
  return {
    '--bz': `${-3000 - Math.round(rnd() * 3000)}px`,
    '--brx': `${Math.round((rnd() - 0.5) * 160)}deg`,
    '--bry': `${Math.round((rnd() - 0.5) * 160)}deg`,
    '--brz': `${Math.round((rnd() - 0.5) * 300)}deg`,
    '--bt': `${850 + Math.round(rnd() * 350)}ms`,
    '--bd': `${Math.round(rnd() * 70)}ms`,
  }
}

// The hero's own motion (2026-10-11, so it isn't the reference site's
// flowers again): soft blobs that keep changing shape, a few lines that draw
// themselves and let go, small pieces drifting. The flowers stay below, as
// stages for the pictures. Blobs morph with SMIL (<animate> on the path), the
// rest is CSS transforms and dash offsets; all of it pauses off screen and
// for reduced motion.
const BLOB_EASE = Array(4).fill('0.45 0 0.55 1').join(';')
const heroBlobs = [
  { color: C.green, x: 7, y: 26, s: 210, seed: 3, dur: 16, m: [2, 16, 120] as [number, number, number] },
  { color: C.marigold, x: 93, y: 14, s: 150, seed: 7, dur: 13, m: [98, 10, 96] as [number, number, number] },
  { color: C.poppy, x: 94, y: 80, s: 220, seed: 11, dur: 18, m: [100, 92, 120] as [number, number, number] },
  { color: C.blue, x: 5, y: 82, s: 140, seed: 5, dur: 14, m: [0, 94, 90] as [number, number, number] },
  { color: C.violet, x: 46, y: 100, s: 120, seed: 13, dur: 12 },
].map(b => ({ ...b, frames: blobFrames(b.seed) }))
// Hand-drawn strokes, each in its own 200 × 120 box.
const heroLines = [
  { d: 'M8 70C38 18 62 112 96 62S150 12 192 58', color: C.blue, x: 15, y: 35, s: 140, r: -14, delay: 0 },
  { d: 'M10 80C60 90 90 60 82 36S40 18 46 50 100 96 130 70 168 24 190 40', color: C.poppy, x: 80, y: 63, s: 140, r: 6, delay: 2.3 },
  { d: 'M12 96Q100 -4 188 96', color: C.violet, x: 72, y: 18, s: 120, r: -4, delay: 4.1, dashed: true },
  { d: 'M14 60C50 20 80 100 110 60S170 30 186 62', color: C.green, x: 37, y: 91, s: 110, r: 8, delay: 1.2, m: [24, 74] as [number, number] },
]
// Small pieces drifting on their own loops.
const heroPieces = [
  { kind: 'ring', color: C.violet, x: 13, y: 43, s: 26, dur: 9 },
  { kind: 'dot', color: C.marigold, x: 36, y: 22, s: 14, dur: 7, m: [16, 30] as [number, number] },
  { kind: 'plus', color: C.green, x: 81, y: 30, s: 22, dur: 10, m: [86, 28] as [number, number] },
  { kind: 'pill', color: C.blue, x: 86, y: 61, s: 36, dur: 11, r: 30 },
  { kind: 'dot', color: C.poppy, x: 64, y: 95, s: 12, dur: 8 },
  { kind: 'ring', color: C.green, x: 44, y: 78, s: 18, dur: 12 },
  { kind: 'plus', color: C.poppy, x: 10, y: 63, s: 18, dur: 9 },
  { kind: 'dot', color: C.blue, x: 58, y: 7, s: 10, dur: 10 },
]
// Moments from different kinds of recaps, as stickers: no business names,
// so the page talks to any business rather than to one example.
const heroStickers = [
  { big: '86', small: 'classes at the studio', bg: '#E2457A', fg: '#FFFFFF', x: 28, y: 14, r: -7 },
  { big: '212', small: 'days in the app', bg: '#4F46E5', fg: '#FFFFFF', x: 18, y: 53, r: -8 },
  { big: 'Top 6%', small: 'of all readers', bg: '#C8341B', fg: '#FFFFFF', x: 84, y: 58, r: 7 },
  { big: '14', small: 'orders this year', bg: '#1F6F4A', fg: '#FFFFFF', x: 27, y: 87, r: 5, m: [54, 91] as [number, number] },
]
// What lands in each customer's inbox when the business sends the links.
const heroMail = [
  { from: 'Your business', when: 'now', text: 'Ana, your 2026 Highreel is here', x: 51, y: 12, r: -2, m: [50, 18] as [number, number] },
  { from: 'Your business', when: '2m ago', text: 'Leon, here\'s your year with us', x: 61, y: 85, r: 2 },
]

const closingShapes: ShapeSpot[] = [
  { kind: 'poppy', color: C.poppy, x: 9, y: 19, s: 112, r: 14, m: [8, 10, 64] },
  { kind: 'marigold', color: C.marigold, x: 42, y: 8, s: 40, r: 10 },
  { kind: 'poppy', color: C.poppy, x: 64, y: 12, s: 32 },
  { kind: 'scallop', color: C.blue, x: 90, y: 20, s: 96, m: [92, 9, 54] },
  { kind: 'clover', color: C.green, x: 4, y: 48, s: 44 },
  { kind: 'daisy', color: C.violet, x: 96, y: 44, s: 38 },
  { kind: 'marigold', color: C.marigold, x: 10, y: 76, s: 96, r: -12, m: [10, 78, 54] },
  { kind: 'scallop', color: C.blue, x: 36, y: 84, s: 40 },
  { kind: 'daisy', color: C.violet, x: 57, y: 86, s: 76, r: 6 },
  { kind: 'clover', color: C.green, x: 88, y: 76, s: 120, r: -20, m: [90, 76, 60] },
]
const closingStickers = [
  { big: '3 days', small: 'at summer camp', bg: '#F5C518', fg: '#222222', x: 22, y: 17, r: 6 },
  { big: 'Top 5%', small: 'of all members', bg: '#4F46E5', fg: '#FFFFFF', x: 75, y: 82, r: -6 },
]

// --- The playing example ------------------------------------------------------------
// After the share slide, move on to the next example, until someone picks one.
const stage = ref<HTMLElement | null>(null)
// The phone lazy-loads a wrapper around the player (see LandingPlayer for why).
const phone = ref<InstanceType<typeof LandingPlayer> | null>(null)
const player = computed(() => phone.value?.player ?? null)
let autoCycle = true
let cycleTimer: ReturnType<typeof setTimeout> | undefined
const stageVisible = ref(false)
const atEnd = computed(() => !!player.value && player.value.index >= player.value.count - 1)
// The phone's status bar follows the slide: light on dark colours, dark on light ones.
const statusInk = computed(() => player.value?.tone?.fg
  ?? (current.value.payload.settings.theme === 'paper' ? '#1A1A1A' : readableOn(current.value.payload.business.accent_color)))

function select(i: number, manual = true) {
  if (manual)
    autoCycle = false
  active.value = i
}
watch([atEnd, stageVisible], ([end, visible]) => {
  clearTimeout(cycleTimer)
  if (end && visible && autoCycle)
    cycleTimer = setTimeout(() => select((active.value + 1) % examples.length, false), 4500)
})
// The story plays only while the phone is on screen.
watch([stageVisible, player], ([visible, p]) => {
  if (p)
    p.playing = visible
})

// --- How it works, pricing, questions (their words: data/landing.ts) ---------------------
const stepPictures = [
  { n: 'one', vignette: 'sheet', shape: { kind: 'clover', color: C.green, r: -12 } },
  { n: 'two', vignette: 'brand', shape: { kind: 'poppy', color: C.poppy, r: 10 } },
  { n: 'three', vignette: 'share', shape: { kind: 'marigold', color: C.marigold, r: 8 } },
] as const
const steps = STEPS.map((s, i) => ({ ...s, ...stepPictures[i]! }))

// Get started on any of them: the price follows the list's size.
const tiers = TIERS

const includeShapes = [
  { kind: 'marigold', color: C.marigold },
  { kind: 'scallop', color: C.blue },
  { kind: 'poppy', color: C.poppy },
  { kind: 'clover', color: C.green },
] as const
const includes = INCLUDES.map((c, i) => ({ ...c, ...includeShapes[i]! }))

const faqs = FAQS

// Structured data for search (SPEC M2.11): who makes it, the product and its
// prices, and the questions above, all as shown on the page.
const org = `${canonical}#organization`
useHead({
  script: [{
    type: 'application/ld+json',
    innerHTML: JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'Organization', '@id': org, 'name': 'Highreel', 'legalName': LEGAL_NAME, 'email': CONTACT_EMAIL, 'url': canonical, 'logo': siteHref('/icon-512.png') },
        { '@type': 'WebSite', '@id': `${canonical}#website`, 'name': 'Highreel', 'url': canonical, 'inLanguage': 'en', 'publisher': { '@id': org } },
        {
          '@type': 'SoftwareApplication',
          'name': 'Highreel',
          'url': canonical,
          'description': description,
          'applicationCategory': 'BusinessApplication',
          'operatingSystem': 'Web',
          'image': ogImage,
          'publisher': { '@id': org },
          'offers': tiers.map(t => ({
            '@type': 'Offer',
            'name': `Up to ${t.size} customers`,
            'price': t.price.replace(/\D/g, ''),
            'priceCurrency': 'USD',
            'url': `${canonical}#pricing`,
          })),
        },
        {
          '@type': 'FAQPage',
          'mainEntity': faqs.map(f => ({ '@type': 'Question', 'name': f.q, 'acceptedAnswer': { '@type': 'Answer', 'text': f.a } })),
        },
      ],
    }).replace(/</g, '\\u003c'),
  }],
})

// --- Scroll: pop sections in, the sticky button, the playing phone ----------------------
// The phone's recap and the step pictures render once they come near the
// screen: they sit below the fold, and server-rendering them made the first
// paint wait on the player's code and their own fonts (Geist, Google Sans Code).
const near = reactive({ phone: false, steps: [false, false, false] })
const stepEls: HTMLElement[] = []
const root = ref<HTMLElement | null>(null)
const heroBits = ref<HTMLElement | null>(null)
const heroCta = ref<HTMLElement | null>(null)
const closingCta = ref<HTMLElement | null>(null)
const stickyOn = ref(false)
onMounted(() => {
  // Sections below the fold wait (hidden) until they scroll in, then pop.
  // Server HTML shows everything in place, so nothing depends on this.
  const pop = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) {
        e.target.classList.add('in')
        pop.unobserve(e.target)
      }
    }
  }, { rootMargin: '0px 0px -10% 0px' })
  if (!reduced.value) {
    for (const el of root.value?.querySelectorAll<HTMLElement>('[data-pop]') ?? []) {
      if (el.getBoundingClientRect().top > window.innerHeight * 0.9) {
        el.classList.add('gate')
        pop.observe(el)
      }
    }
  }

  // The sticky "Try the demo" shows while neither big button is on screen.
  const seen = new Map<Element, boolean>()
  const ctas = new IntersectionObserver((entries) => {
    for (const e of entries)
      seen.set(e.target, e.isIntersecting)
    stickyOn.value = ![...seen.values()].some(Boolean)
  })
  for (const el of [heroCta.value, closingCta.value]) {
    if (el)
      ctas.observe(el)
  }

  // The hero's blobs morph with SMIL, which CSS can't pause: do it here.
  const morphs = [...(heroBits.value?.querySelectorAll<SVGSVGElement>('svg.blob') ?? [])]
  const setMorph = (on: boolean) => morphs.forEach(svg => (on ? svg.unpauseAnimations() : svg.pauseAnimations()))
  if (reduced.value)
    setMorph(false)
  // A sliver must show: an edge that only touches the viewport still counts as intersecting.
  const heroSeen = new IntersectionObserver(([e]) => {
    const seen = !!e?.isIntersecting && e.intersectionRatio > 0
    heroBits.value?.classList.toggle('still', !seen)
    if (!reduced.value)
      setMorph(seen)
  }, { threshold: [0, 0.01] })
  if (heroBits.value)
    heroSeen.observe(heroBits.value)

  const phone = new IntersectionObserver(([e]) => {
    stageVisible.value = !!e?.isIntersecting
  }, { threshold: 0.25 })
  if (stage.value)
    phone.observe(stage.value)

  const soon = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting)
        continue
      if (e.target === stage.value)
        near.phone = true
      else
        near.steps[stepEls.indexOf(e.target as HTMLElement)] = true
      soon.unobserve(e.target)
    }
  }, { rootMargin: '75% 0px' })
  for (const el of [stage.value, ...stepEls]) {
    if (el)
      soon.observe(el)
  }

  onBeforeUnmount(() => {
    pop.disconnect()
    heroSeen.disconnect()
    ctas.disconnect()
    phone.disconnect()
    soon.disconnect()
    clearTimeout(cycleTimer)
  })
})
</script>

<template>
  <div ref="root" class="landing">
    <LandingShapes />

    <!-- Hero -->
    <section class="hero">
      <div ref="heroBits" class="bits" aria-hidden="true">
        <svg
          v-for="(b, i) in heroBlobs"
          :key="`b${i}`"
          class="bit burst shape blob"
          :class="{ desk: !b.m }"
          viewBox="-100 -100 200 200"
          :style="{ color: b.color, '--spin': `${b.dur * 3}s`, ...spot(b, i), ...burst(b, i) }"
        >
          <g class="spin">
            <path :d="b.frames[0]" fill="currentColor">
              <animate attributeName="d" :dur="`${b.dur}s`" repeatCount="indefinite" :values="[...b.frames, b.frames[0]].join(';')" keyTimes="0;0.25;0.5;0.75;1" calcMode="spline" :keySplines="BLOB_EASE" />
            </path>
          </g>
        </svg>
        <svg
          v-for="(l, i) in heroLines"
          :key="`l${i}`"
          class="bit burst doodle"
          :class="{ desk: !l.m, dashed: l.dashed }"
          viewBox="0 0 200 120"
          :style="{ color: l.color, '--w': `${l.s}px`, '--dd': `${l.delay}s`, ...spot(l, i, 260), ...burst(l, 10 + i) }"
        >
          <path :d="l.d" pathLength="1" />
        </svg>
        <span
          v-for="(b, i) in heroPieces"
          :key="`p${i}`"
          class="bit burst piece"
          :class="[`piece-${b.kind}`, { desk: !b.m }]"
          :style="{ color: b.color, '--s': `${b.s}px`, '--float': `${b.dur}s`, ...spot(b, i, 220), ...burst(b, 20 + i) }"
        ><span /></span>
        <div
          v-for="(s, i) in heroStickers"
          :key="s.big"
          class="bit burst sticker"
          :class="{ desk: !s.m }"
          :style="{ '--bg': s.bg, '--fg': s.fg, ...spot(s, i, 380), ...burst(s, 30 + i) }"
        >
          <b>{{ s.big }}</b><span>{{ s.small }}</span>
        </div>
        <div
          v-for="(n, i) in heroMail"
          :key="n.text"
          class="bit burst mail"
          :class="{ desk: !n.m }"
          :style="{ ...spot(n, i, 520), ...burst(n, 40 + i) }"
        >
          <span class="mail-mark"><LandingShape kind="scallop" class="mail-shape" /></span>
          <span class="mail-body">
            <span class="mail-from">{{ n.from }}<span class="mail-when">{{ n.when }}</span></span>
            <span class="mail-text">{{ n.text }}</span>
          </span>
        </div>
      </div>

      <header class="nav">
        <NuxtLink to="/" class="wordmark"><Wordmark /></NuxtLink>
        <div class="nav-actions">
          <ThemeToggle />
          <NuxtLink to="/app" class="pill">Sign in</NuxtLink>
        </div>
      </header>

      <div class="hero-copy">
        <!-- The headline and the lede are there in the first frame (no fade):
             they're the page's largest paint, and the scripts wait for it (SPEC M2.11). -->
        <h1 class="headline">
          <span class="line">Give every customer</span> <span class="line">their year's highlight reel.</span>
        </h1>
        <p class="lede">
          {{ LANDING_LEDE }}
        </p>
        <div ref="heroCta" class="rise" style="--d: 200ms">
          <NuxtLink to="/login?demo=1" class="btn">Try the demo <ArrowRight class="size-[18px]" /></NuxtLink>
        </div>
        <p class="meta rise" style="--d: 260ms">No account needed · from $99 per campaign</p>
      </div>
    </section>

    <!-- The playing example -->
    <section id="examples" class="feature" data-pop>
      <h2 class="h2 rise">For any business with regulars.</h2>
      <p class="sub rise" style="--d: 60ms">{{ LANDING_AUDIENCE }}</p>
      <p class="note rise" style="--d: 120ms">
        {{ current.about }}
        <svg class="arrow" viewBox="0 0 26 44" aria-hidden="true"><path d="M13 2c-7 9 6 15 0 24-2 4-1 10 1 15m-6-6 6 7 5-8" /></svg>
      </p>
      <div ref="stage" class="stage phone-stage">
        <div class="stage-shapes pop" style="--s0: 0.5; --d: 120ms" aria-hidden="true">
          <LandingShape
            v-for="(e, i) in examples"
            :key="e.key"
            :kind="exampleShapes[i]!.kind"
            class="stage-shape"
            :class="{ on: i === active }"
            :style="{ color: e.payload.business.accent_color, '--r': `${exampleShapes[i]!.r}deg` }"
          />
        </div>
        <PhoneFrame class="phone rise" style="--d: 200ms" :ink="statusInk">
          <LazyLandingPlayer v-if="near.phone" :key="current.key" ref="phone" :payload="current.payload" />
          <span v-else class="poster" :style="{ background: current.payload.business.accent_color }" />
        </PhoneFrame>
      </div>
      <div class="switcher rise" role="group" aria-label="Example Highreels">
        <button
          v-for="(e, i) in examples"
          :key="e.key"
          type="button"
          class="tab"
          :aria-pressed="i === active"
          @click="select(i)"
        >
          <span class="tab-dot" :style="{ background: e.payload.business.accent_color }" />{{ e.label }}
        </button>
      </div>
      <NuxtLink :to="`/example/${current.key}`" class="text-link">Open it full screen</NuxtLink>
    </section>

    <!-- How it works -->
    <section id="how" class="how">
      <article v-for="(s, i) in steps" :key="s.n" :ref="el => { if (el) stepEls[i] = el as HTMLElement }" class="feature step" data-pop>
        <p class="note rise">step {{ s.n }}</p>
        <h2 class="h2 rise" style="--d: 60ms">{{ s.title }}</h2>
        <p class="sub rise" style="--d: 120ms">{{ s.body }}</p>
        <div class="stage">
          <div class="stage-shapes wide pop" style="--s0: 0.5; --d: 160ms" aria-hidden="true">
            <LandingShape :kind="s.shape.kind" class="stage-shape on" :style="{ color: s.shape.color, '--r': `${s.shape.r}deg` }" />
          </div>
          <div class="window rise" style="--d: 260ms">
            <template v-if="near.steps[i]">
              <LazyVignetteSheet v-if="s.vignette === 'sheet'" />
              <LazyVignetteBrand v-else-if="s.vignette === 'brand'" />
              <LazyVignetteShare v-else />
            </template>
            <span v-else class="poster" />
          </div>
        </div>
      </article>
    </section>

    <!-- Pricing -->
    <section id="pricing" class="feature pricing" data-pop>
      <h2 class="h2 rise">One price for the whole campaign.</h2>
      <p class="sub rise" style="--d: 60ms">{{ PRICING_LEAD }}</p>
      <ul class="tiers">
        <li v-for="(t, i) in tiers" :key="t.size" class="tier rise" :class="{ founding: t.founding }" :style="{ '--d': `${120 + i * 60}ms` }">
          <p v-if="t.founding" class="tier-sticker"><b>$100 off</b><span>founding price</span></p>
          <p class="tier-size">Up to {{ t.size }} customers</p>
          <p class="tier-price">
            {{ t.price }}<s v-if="t.was" class="tier-was"><span class="sr-only">instead of </span>{{ t.was }}</s>
          </p>
          <p class="tier-per">for the whole campaign</p>
          <NuxtLink to="/login?start=1" class="tier-btn">Get started</NuxtLink>
        </li>
      </ul>
      <p class="includes-title rise">Every campaign includes</p>
      <ul class="includes">
        <li v-for="(c, i) in includes" :key="c.title" class="include rise" :style="{ '--d': `${80 + i * 50}ms` }">
          <LandingShape :kind="c.kind" class="include-icon" :style="{ color: c.color }" />
          <span><b>{{ c.title }}</b> {{ c.body }}</span>
        </li>
      </ul>
      <NuxtLink to="/login?demo=1" class="btn rise" style="--d: 300ms">Try the demo <ArrowRight class="size-[18px]" /></NuxtLink>
    </section>

    <!-- Questions -->
    <section class="faq" data-pop>
      <h2 class="faq-title rise">Questions</h2>
      <details v-for="(f, i) in faqs" :key="f.q" class="qa rise" :style="{ '--d': `${60 + i * 60}ms` }">
        <summary>{{ f.q }}<ChevronDown class="chev" /></summary>
        <p>{{ f.a }}</p>
      </details>
    </section>

    <!-- Closing -->
    <footer class="closing" data-pop>
      <div class="bits" aria-hidden="true">
        <LandingShape
          v-for="(b, i) in closingShapes"
          :key="`c${i}`"
          :kind="b.kind"
          class="bit pop shape"
          :class="{ desk: !b.m }"
          :style="{ color: b.color, ...spot(b, i, 80) }"
        />
        <div
          v-for="(s, i) in closingStickers"
          :key="s.big"
          class="bit pop sticker desk"
          :style="{ '--bg': s.bg, '--fg': s.fg, ...spot(s, i * 2 + 2, 260) }"
        >
          <b>{{ s.big }}</b><span>{{ s.small }}</span>
        </div>
      </div>
      <div class="closing-copy">
        <h2 class="closing-title rise">Get your Highreels ready for December.</h2>
        <div ref="closingCta" class="rise" style="--d: 100ms">
          <NuxtLink to="/login?demo=1" class="btn">Try the demo <ArrowRight class="size-[18px]" /></NuxtLink>
        </div>
      </div>
      <div class="foot">
        <p class="foot-mark">
          <span class="wordmark small"><Wordmark still /></span>
          <span>© 2026 {{ LEGAL_NAME }}</span>
        </p>
        <nav class="foot-links" aria-label="Footer">
          <NuxtLink to="/terms" class="foot-link">Terms</NuxtLink>
          <NuxtLink to="/privacy" class="foot-link">Privacy</NuxtLink>
          <a :href="`mailto:${CONTACT_EMAIL}`" class="foot-link">{{ CONTACT_EMAIL }}</a>
        </nav>
      </div>
    </footer>

    <NuxtLink to="/login?demo=1" class="btn btn-sm sticky-cta" :class="{ on: stickyOn }">Try the demo</NuxtLink>
  </div>
</template>

<style>
body.landing-page {
  background: #FFFFFF;
}
.dark body.landing-page {
  background: #121212;
}
/* Caveat, cut down to the notes' characters (scripts/subset-caveat.py, OFL) */
@font-face {
  font-family: 'Recap Notes';
  src: url('/fonts/caveat-notes.woff2') format('woff2');
  font-display: swap;
}
</style>

<style scoped>
.landing {
  --surface: #FFFFFF;
  --ink: #222222;
  --ink-hover: #000000;
  --muted: #6F6F6F;
  /* handwritten notes only: 24 px and up, so 3:1 is enough */
  --faint: #7E7E7E;
  --card: #F2F2F2;
  --card-hover: #E6E6E6;
  /* small text on a price card: a shade darker than --muted, 4.5:1 on --card */
  --card-muted: #5C5C5C;
  --line: #E7E7E7;
  --bubble: rgb(232 232 237 / 0.85);
  --bubble-text: #3A3A3A;
  --cta: #4560FF;
  --spring: cubic-bezier(0.25, 1.35, 0.45, 1);
  --ease-out: cubic-bezier(0.22, 1, 0.36, 1);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --v-warn: #D2371F;
  overflow-x: clip;
  background: var(--surface);
  color: var(--ink);
  font-family: 'Outfit', var(--font-sans);
  font-size: 1rem;
  line-height: 1.5;
}

/* Dark (ThemeToggle, or the app's Dark mode): the same page on near-black. The
   blue, the shapes, the stickers and the step pictures keep their colours; the
   pictures stay light, like the app they show. Text is 4.5:1 or more on the
   surface and the cards (muted 7.4:1, card text 6.6:1). */
:global(.dark .landing) {
  --surface: #121212;
  --ink: #F2F2F2;
  --ink-hover: #FFFFFF;
  --muted: #A3A3A3;
  --faint: #8C8C8C;
  --card: #1E1E1E;
  --card-hover: #2A2A2A;
  --card-muted: #A3A3A3;
  --line: #2C2C2C;
  --bubble: rgb(44 44 48 / 0.9);
  --bubble-text: #C8C8C8;
  color-scheme: dark;
}

/* --- Type -------------------------------------------------------------------- */
.wordmark {
  font-size: 26px;
  font-weight: 700;
  letter-spacing: -0.035em;
  text-decoration: none;
}
.wordmark.small { font-size: 17px; color: var(--ink); }
.headline {
  max-width: 13em;
  font-size: clamp(2.6rem, 7vw, 5.25rem);
  font-weight: 600;
  line-height: 1.04;
  letter-spacing: -0.03em;
  text-wrap: balance;
}
@media (min-width: 720px) {
  .headline .line { display: block; }
}
.h2 {
  max-width: 14em;
  margin-inline: auto;
  font-size: clamp(2.2rem, 4.6vw, 3.5rem);
  font-weight: 600;
  line-height: 1.1;
  letter-spacing: -0.025em;
  text-wrap: balance;
}
.lede {
  max-width: 32rem;
  margin-top: 22px;
  color: var(--muted);
  font-size: clamp(1.08rem, 1.5vw, 1.25rem);
  font-weight: 500;
  line-height: 1.5;
}
.sub {
  max-width: 33rem;
  margin: 16px auto 0;
  color: var(--muted);
  font-size: 1.125rem;
  font-weight: 500;
}
.note {
  margin-top: 14px;
  color: var(--faint);
  font-family: 'Recap Notes', cursive;
  font-size: clamp(1.45rem, 2.2vw, 1.65rem);
  line-height: 1.15;
}
.arrow {
  display: block;
  width: 18px;
  height: 32px;
  margin: 6px auto 0;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.meta {
  margin-top: 16px;
  color: var(--muted);
  font-size: 14px;
  font-weight: 500;
}

/* --- Buttons ------------------------------------------------------------------ */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 56px;
  padding: 0 28px;
  border-radius: 9999px;
  background: var(--cta);
  color: #FFFFFF;
  font-size: 17px;
  font-weight: 500;
  text-decoration: none;
  white-space: nowrap;
  transition: transform 180ms var(--spring), background-color 160ms ease;
}
.btn:hover { background: #3550F5; transform: scale(1.03); }
.btn:active { transform: scale(0.97); }
.btn:focus-visible,
.pill:focus-visible,
.tier-btn:focus-visible,
.tab:focus-visible,
.text-link:focus-visible,
.qa summary:focus-visible {
  outline: 2px solid var(--cta);
  outline-offset: 3px;
}
.btn-sm { height: 40px; padding: 0 18px; font-size: 15px; }
.sticky-cta {
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 20;
  /* floats over everything, the blue price card too */
  box-shadow: 0 0 0 2px var(--surface), 0 8px 20px -8px rgb(0 0 0 / 0.35);
  visibility: hidden;
  opacity: 0;
  transform: translateY(-8px) scale(0.92);
  transition: opacity 200ms ease, transform 300ms var(--spring), visibility 0s linear 300ms, background-color 160ms ease;
}
.sticky-cta.on {
  visibility: visible;
  opacity: 1;
  transform: none;
  transition: opacity 200ms ease, transform 300ms var(--spring), visibility 0s, background-color 160ms ease;
}
.text-link {
  display: inline-block;
  margin-top: 18px;
  color: var(--muted);
  font-size: 15px;
  font-weight: 500;
  text-decoration: underline;
  text-decoration-color: color-mix(in srgb, currentColor 40%, transparent);
  text-underline-offset: 4px;
}
.text-link:hover { color: var(--ink); }

/* --- Scattered pieces (hero and closing) --------------------------------------- */
.bits {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.bit {
  position: absolute;
  left: var(--x);
  top: var(--y);
  translate: -50% -50%;
  transform: rotate(var(--r, 0deg));
}
.shape { width: var(--s); height: var(--s); }

/* The hero's ambient motion. Blobs turn slowly while they morph; lines draw
   in, rest, and let go; pieces float on their own loops. */
.blob .spin {
  transform-box: fill-box;
  transform-origin: center;
  animation: spin var(--spin, 40s) linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.doodle {
  width: var(--w);
  height: calc(var(--w) * 0.6);
  overflow: visible;
}
.doodle path {
  fill: none;
  stroke: currentColor;
  stroke-width: 7;
  stroke-linecap: round;
  stroke-dasharray: 1 1;
  animation: draw 7.5s var(--ease-in-out) var(--dd, 0s) infinite both;
}
@keyframes draw {
  0% { stroke-dashoffset: 1; }
  32%, 68% { stroke-dashoffset: 0; }
  100% { stroke-dashoffset: -1; }
}
.doodle.dashed path {
  stroke-width: 6;
  stroke-dasharray: 0.035 0.045;
  animation: march 14s linear infinite;
}
@keyframes march { to { stroke-dashoffset: -1; } }
.piece > span {
  display: block;
  width: var(--s);
  height: var(--s);
  animation: float var(--float, 9s) var(--ease-in-out) infinite;
}
@keyframes float {
  0%, 100% { transform: translate(0, 0) rotate(0deg); }
  33% { transform: translate(8px, -12px) rotate(25deg); }
  66% { transform: translate(-7px, 6px) rotate(-15deg); }
}
.piece-dot > span { border-radius: 50%; background: currentColor; }
.piece-ring > span { border-radius: 50%; box-shadow: inset 0 0 0 4px currentColor; }
.piece-pill > span { height: calc(var(--s) * 0.42); border-radius: 9999px; background: currentColor; }
.piece-plus > span {
  background:
    linear-gradient(currentColor, currentColor) center / 100% 28% no-repeat,
    linear-gradient(currentColor, currentColor) center / 28% 100% no-repeat;
  border-radius: 3px;
}
.still .spin, .still .doodle path, .still .piece > span { animation-play-state: paused; }
@media (max-width: 719px) {
  .bit { left: var(--mx, var(--x)); top: var(--my, var(--y)); }
  .shape { width: var(--ms, var(--s)); height: var(--ms, var(--s)); }
  .bit.desk { display: none; }
}

/* Pieces pop out from the middle with a little overshoot. The base style is
   where they rest; reduced motion and gated sections skip the animation. */
.pop { animation: pop 560ms var(--spring) var(--d, 0ms) both; }
@keyframes pop {
  0% { opacity: 0; transform: translate(var(--dx, 0px), var(--dy, 0px)) scale(var(--s0, 0.3)) rotate(var(--r, 0deg)); }
  35% { opacity: 1; }
  100% { opacity: 1; transform: rotate(var(--r, 0deg)); }
}
.rise { animation: rise 700ms var(--ease-out) var(--d, 0ms) both; }
@keyframes rise {
  from { opacity: 0; transform: translateY(18px); }
}
.gate .pop,
.gate .rise { animation: none; opacity: 0; }
.gate.in .pop { animation: pop 560ms var(--spring) var(--d, 0ms) both; opacity: 1; }
.gate.in .rise { animation: rise 700ms var(--ease-out) var(--d, 0ms) both; opacity: 1; }

/* The hero's opening burst (burst() in the script). With perspective on the
   pieces' layer, a piece far behind the screen is drawn small and close to the
   middle; flying to z 0 it spreads out to its spot at full size, faster as it
   nears, tumbling flat. It overshoots towards the viewer a little (5 % larger)
   and settles. Transform and opacity only; the base style is where it rests. */
.hero .bits { perspective: 700px; }
.burst { animation: burst var(--bt, 1000ms) linear var(--bd, 0ms) both; }
@keyframes burst {
  0% {
    opacity: 0;
    transform: translateZ(var(--bz)) rotateX(var(--brx)) rotateY(var(--bry)) rotate(calc(var(--r, 0deg) + var(--brz)));
    animation-timing-function: cubic-bezier(0.1, 0.75, 0.25, 1);
  }
  7% { opacity: 1; }
  74% {
    transform: translateZ(36px) rotateX(0deg) rotateY(0deg) rotate(var(--r, 0deg));
    animation-timing-function: cubic-bezier(0.35, 0, 0.3, 1);
  }
  100% { opacity: 1; transform: translateZ(0px) rotateX(0deg) rotateY(0deg) rotate(var(--r, 0deg)); }
}

.sticker {
  padding: 11px 16px 12px;
  border-radius: 18px;
  background: var(--bg);
  color: var(--fg);
  box-shadow: 0 0 0 5px var(--surface), 0 12px 26px -8px rgb(0 0 0 / 0.3);
  white-space: nowrap;
}
.sticker b {
  display: block;
  font-size: 34px;
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.03em;
}
.sticker span {
  display: block;
  margin-top: 4px;
  font-size: 13px;
  font-weight: 500;
  opacity: 0.9;
}
.mail {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 284px;
  padding: 9px 16px 9px 9px;
  border-radius: 22px;
  background: var(--bubble);
  text-align: left;
}
@media (max-width: 719px) {
  .mail { width: 260px; }
}
.mail-mark {
  display: grid;
  flex: none;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--cta);
  color: #FFFFFF;
}
.mail-shape { width: 18px; height: 18px; }
.mail-body { min-width: 0; flex: 1; font-size: 13px; line-height: 1.3; }
.mail-from {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-weight: 600;
}
.mail-when { color: #8A8A8A; font-size: 12px; font-weight: 400; }
.mail-text {
  display: block;
  overflow: hidden;
  color: var(--bubble-text);
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* --- Hero ------------------------------------------------------------------------ */
.hero {
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: max(660px, 100svh);
}
.nav {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 76px;
  padding-inline: 20px;
}
@media (min-width: 720px) {
  .nav { padding-inline: 40px; }
}
.nav-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
/* Sign in: an ink pill, so the top corner is easy to find; the hero's blue
   "Try the demo" stays the page's main button. */
.pill {
  display: inline-flex;
  align-items: center;
  height: 40px;
  padding: 0 18px;
  border-radius: 9999px;
  background: var(--ink);
  color: var(--surface);
  font-size: 15px;
  font-weight: 500;
  text-decoration: none;
  white-space: nowrap;
  transition: transform 180ms var(--spring), background-color 160ms ease;
}
.pill:hover { background: var(--ink-hover); transform: scale(1.03); }
.pill:active { transform: scale(0.97); }
@media (max-width: 379px) {
  .nav-actions { gap: 6px; }
  .pill { padding: 0 14px; }
}
.hero-copy {
  position: relative;
  z-index: 1;
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 72px 16px 132px;
  text-align: center;
}
.hero-copy .btn { margin-top: 30px; }
@media (min-width: 720px) {
  .hero-copy { padding: 24px 32px 96px; }
}

/* --- Feature sections --------------------------------------------------------------- */
.feature {
  padding: clamp(88px, 13vw, 168px) 16px 0;
  text-align: center;
}
.stage {
  position: relative;
  display: grid;
  place-items: center;
  margin-top: 48px;
  padding-block: clamp(56px, 7vw, 90px);
}
.phone-stage {
  margin-top: 4px;
  padding-block: 36px 44px;
}
.stage-shapes {
  position: absolute;
  pointer-events: none;
  left: 50%;
  top: 50%;
  width: min(126vw, 660px);
  aspect-ratio: 1;
  margin: calc(min(126vw, 660px) / -2) 0 0 calc(min(126vw, 660px) / -2);
}
.step .stage { margin-top: clamp(88px, 11vw, 136px); }
.stage-shapes.wide {
  width: min(112vw, 680px);
  margin: calc(min(112vw, 680px) / -2) 0 0 calc(min(112vw, 680px) / -2);
}
.stage-shape {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  transform: rotate(var(--r)) scale(0.6);
  transition: opacity 220ms ease, transform 750ms var(--spring), color 300ms ease;
}
.stage-shape.on { opacity: 1; transform: rotate(var(--r)); }

.phone {
  width: min(70vw, 290px);
  font-family: var(--font-sans);
}
.phone .poster { display: block; }
/* stand-ins until the recap and the pictures render (see `near`) */
.window .poster {
  display: block;
  aspect-ratio: 4 / 3;
  border-radius: 20px;
  background: #EFEFEF;
}
.switcher {
  position: relative;
  z-index: 1;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  margin-top: 8px;
}
.tab {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 42px;
  padding: 0 17px;
  border-radius: 9999px;
  background: var(--card);
  color: var(--ink);
  font-size: 15px;
  font-weight: 500;
  transition: background-color 180ms ease, color 180ms ease, transform 180ms var(--spring);
}
.tab:hover { background: var(--card-hover); }
.tab:active { transform: scale(0.96); }
.tab[aria-pressed='true'] { background: var(--ink); color: var(--surface); }
.tab-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  box-shadow: 0 0 0 1.5px var(--surface);
}

/* How it works: each step's picture in a window on its shape. */
.window {
  position: relative;
  width: min(100%, 520px);
  padding: 12px;
  border-radius: 28px;
  background: #FFFFFF;
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.06), 0 28px 56px -22px rgb(0 0 0 / 0.38);
  color: #0A0A0A;
  text-align: left;
}

/* --- Pricing ---------------------------------------------------------------------------- */
.tiers {
  display: grid;
  gap: 16px;
  max-width: 900px;
  margin: 84px auto 0;
  text-align: left;
}
@media (min-width: 760px) {
  .tiers { grid-template-columns: repeat(3, 1fr); }
}
.tier {
  --muted: var(--card-muted);
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 28px 26px 26px;
  border-radius: 28px;
  background: var(--card);
}
/* The founding price is the one to take: the page's blue, with a sticker like the
   hero's. Everything on it stays pure white (4.8:1 on the blue). */
.tier.founding {
  --muted: #FFFFFF;
  background: var(--cta);
  color: #FFFFFF;
}
.tier-sticker {
  position: absolute;
  /* on the card's top edge, clear of its first line */
  top: -46px;
  right: 14px;
  padding: 9px 14px 10px;
  border-radius: 16px;
  background: #F5C518;
  color: #222222;
  box-shadow: 0 0 0 4px var(--surface), 0 10px 22px -8px rgb(0 0 0 / 0.3);
  transform: rotate(6deg);
  white-space: nowrap;
}
.tier-sticker b {
  display: block;
  font-size: 24px;
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.03em;
}
.tier-sticker span {
  display: block;
  margin-top: 3px;
  font-size: 12px;
  font-weight: 600;
}
.tier-size {
  font-size: 17px;
  font-weight: 600;
}
.tier-price {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-top: 18px;
  font-size: 56px;
  font-weight: 600;
  line-height: 1;
  letter-spacing: -0.035em;
}
.tier-was {
  color: var(--muted);
  font-size: 22px;
  font-weight: 500;
  letter-spacing: -0.01em;
}
.tier-per {
  margin: 10px 0 28px;
  color: var(--muted);
  font-size: 15px;
}
.tier-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 48px;
  margin-top: auto;
  border-radius: 9999px;
  background: #FFFFFF;
  color: #222222;
  font-size: 16px;
  font-weight: 500;
  text-decoration: none;
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.08);
  transition: transform 180ms var(--spring);
}
.tier.founding .tier-btn { color: var(--cta); }
.tier.founding .tier-btn:focus-visible { outline-color: #FFFFFF; }
.tier-btn:hover { transform: scale(1.02); }
.tier-btn:active { transform: scale(0.98); }
.includes-title {
  margin-top: 56px;
  font-size: 18px;
  font-weight: 600;
}
.includes {
  display: grid;
  gap: 14px 28px;
  max-width: 860px;
  margin: 20px auto 44px;
  text-align: left;
}
@media (min-width: 720px) {
  .includes { grid-template-columns: 1fr 1fr; }
}
.include {
  display: flex;
  gap: 14px;
  align-items: flex-start;
  color: var(--muted);
  font-size: 16px;
}
.include b { color: var(--ink); font-weight: 600; }
.include-icon { flex: none; width: 26px; height: 26px; margin-top: 1px; }

/* --- Questions --------------------------------------------------------------------------- */
.faq {
  max-width: 656px;
  margin: 0 auto;
  padding: clamp(96px, 13vw, 168px) 16px 0;
}
.faq-title {
  margin-bottom: 28px;
  font-size: clamp(2.2rem, 4.6vw, 3.25rem);
  font-weight: 700;
  letter-spacing: -0.03em;
}
.qa { border-bottom: 1px solid var(--line); }
.qa summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 24px 0;
  font-size: 1.2rem;
  font-weight: 500;
  list-style: none;
  cursor: pointer;
}
.qa summary::-webkit-details-marker { display: none; }
.chev {
  flex: none;
  width: 20px;
  height: 20px;
  color: #8A8A8A;
  transition: transform 260ms var(--spring);
}
.qa[open] .chev { transform: rotate(180deg); }
.qa p {
  max-width: 34rem;
  padding-bottom: 24px;
  color: var(--muted);
  font-size: 1.06rem;
}

/* --- Closing ------------------------------------------------------------------------------ */
.closing {
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: max(640px, 92svh);
  margin-top: clamp(64px, 9vw, 120px);
}
.closing-copy {
  position: relative;
  z-index: 1;
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 120px 16px;
  text-align: center;
}
.closing-title {
  max-width: 12em;
  margin-bottom: 32px;
  font-size: clamp(2.6rem, 6.4vw, 4.75rem);
  font-weight: 600;
  line-height: 1.04;
  letter-spacing: -0.03em;
  text-wrap: balance;
}
.foot {
  position: relative;
  z-index: 1;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 14px 32px;
  margin: 0 20px;
  padding: 22px 0 28px;
  border-top: 1px solid var(--line);
  color: var(--muted);
  font-size: 14px;
  font-weight: 500;
}
@media (min-width: 720px) {
  .foot { margin-inline: 40px; }
}
/* Phones: the links first, the copyright last, all on the left. */
@media (max-width: 719px) {
  .foot { flex-direction: column-reverse; align-items: flex-start; }
}
.foot-mark {
  display: flex;
  align-items: baseline;
  gap: 14px;
}
.foot-links {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 24px;
}
.foot-link {
  color: inherit;
  text-decoration: none;
}
.foot-link:hover {
  color: var(--ink);
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 3px;
}
.foot-link:focus-visible {
  outline: 2px solid var(--cta);
  outline-offset: 3px;
  border-radius: 4px;
}

@media (prefers-reduced-motion: reduce) {
  .pop, .rise, .burst, .gate.in .pop, .gate.in .rise { animation: none !important; opacity: 1 !important; }
  .blob .spin, .doodle path, .piece > span { animation: none !important; }
  .stage-shape, .sticky-cta, .btn, .pill, .tier-btn, .tab, .chev { transition: none; }
}
</style>
