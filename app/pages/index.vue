<script setup lang="ts">
// Landing (SPEC M2.5 P2, restyled 2026-10-11 after trysundrop.app). A white
// page with big centred headlines; flower shapes, recap stickers and mail
// bubbles pop out around the hero and the closing call to action. Each
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

const title = 'Highreel · Give every customer their year\'s highlight reel'
const description = 'Spotify Wrapped for your business: upload a sheet of your customers and each one gets an animated highlight reel of their year to share. From $99 per campaign.'
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
  { from: 'Your business', when: 'now', text: 'Ana, your 2026 reel is here', x: 51, y: 12, r: -2, m: [50, 18] as [number, number] },
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

// --- How it works ---------------------------------------------------------------------
const steps = [
  {
    n: 'one',
    title: 'Fill in the sheet.',
    body: 'One row per customer: a first name and their numbers for the year. CSV or Excel, with our columns or your own. Anything that needs fixing turns red, and you fix it right in the grid.',
    vignette: 'sheet',
    shape: { kind: 'clover', color: C.green, r: -12 },
  },
  {
    n: 'two',
    title: 'Make it look like you.',
    body: 'Add your logo and colour, choose a theme and rewrite any line. Click any customer to see their highlight reel change as you type.',
    vignette: 'brand',
    shape: { kind: 'poppy', color: C.poppy, r: 10 },
  },
  {
    n: 'three',
    title: 'Share it with your members.',
    body: 'Publish, and everyone on your list gets a personal link. Send them from your own email address or on WhatsApp; they open their highlight reel, save it and share it, and you see who did.',
    vignette: 'share',
    shape: { kind: 'marigold', color: C.marigold, r: 8 },
  },
] as const

// SPEC §10: one price per campaign by list size; $99 is the founding price of the smallest.
const tiers = [
  { size: '1,000', price: '$99', was: '$199', founding: true },
  { size: '10,000', price: '$399' },
  { size: '50,000', price: '$799' },
]

const includes = [
  { title: 'A template for your business', body: 'Apps, newsletters, shops, cafés, gyms, schools, camps and daycares.', kind: 'marigold', color: C.marigold },
  { title: 'Your brand on every slide', body: 'Your logo, your colours and your words.', kind: 'scallop', color: C.blue },
  { title: 'Edit after publishing', body: 'Fix a line or a number; the links stay the same.', kind: 'poppy', color: C.poppy },
  { title: 'Made to be shared', body: 'A share image and a link preview for every customer.', kind: 'clover', color: C.green },
] as const

const faqs = [
  {
    q: 'What counts as a campaign?',
    a: 'One send to one list: your sheet of customers, your brand and wording, and a personal highlight reel for each person on it. You pay once for the whole list, not per customer. Your 2026 highlight reels are one campaign; doing them again for 2027 is another.',
  },
  {
    q: 'Do you email my customers?',
    a: 'Not from us. Connect your own email account and every highlight reel goes out from your address, to your list. You can also send them one tap at a time on WhatsApp, or download the links for the email tool you already use.',
  },
  {
    q: 'What data do you need?',
    a: 'One row per customer with the columns of the template you pick: an id, a first name and their numbers, like active days or orders. Your own columns can become slides too. Add an email or a phone number only if you want to send the highlight reels from here; they never appear in one.',
  },
  {
    q: 'Can I try it first?',
    a: 'Yes. The demo runs the whole thing with sample data and needs no account: upload, brand, preview, publish and open the links.',
  },
]

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
          class="bit pop shape blob"
          :class="{ desk: !b.m }"
          viewBox="-100 -100 200 200"
          :style="{ color: b.color, '--spin': `${b.dur * 3}s`, ...spot(b, i) }"
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
          class="bit pop doodle"
          :class="{ desk: !l.m, dashed: l.dashed }"
          viewBox="0 0 200 120"
          :style="{ color: l.color, '--w': `${l.s}px`, '--dd': `${l.delay}s`, ...spot(l, i, 260) }"
        >
          <path :d="l.d" pathLength="1" />
        </svg>
        <span
          v-for="(b, i) in heroPieces"
          :key="`p${i}`"
          class="bit pop piece"
          :class="[`piece-${b.kind}`, { desk: !b.m }]"
          :style="{ color: b.color, '--s': `${b.s}px`, '--float': `${b.dur}s`, ...spot(b, i, 220) }"
        ><span /></span>
        <div
          v-for="(s, i) in heroStickers"
          :key="s.big"
          class="bit pop sticker"
          :class="{ desk: !s.m }"
          :style="{ '--bg': s.bg, '--fg': s.fg, ...spot(s, i, 380) }"
        >
          <b>{{ s.big }}</b><span>{{ s.small }}</span>
        </div>
        <div
          v-for="(n, i) in heroMail"
          :key="n.text"
          class="bit pop mail"
          :class="{ desk: !n.m }"
          :style="spot(n, i, 520)"
        >
          <span class="mail-mark"><LandingShape kind="scallop" class="mail-shape" /></span>
          <span class="mail-body">
            <span class="mail-from">{{ n.from }}<span class="mail-when">{{ n.when }}</span></span>
            <span class="mail-text">{{ n.text }}</span>
          </span>
        </div>
      </div>

      <header class="nav">
        <NuxtLink to="/" class="wordmark">highreel</NuxtLink>
        <NuxtLink to="/app" class="nav-link">Sign in</NuxtLink>
      </header>

      <div class="hero-copy">
        <!-- The headline and the lede are there in the first frame (no fade):
             they're the page's largest paint, and the scripts wait for it (SPEC M2.11). -->
        <h1 class="headline">
          <span class="line">Give every customer</span> <span class="line">their year's highlight reel.</span>
        </h1>
        <p class="lede">
          Spotify Wrapped, for your business. Upload a sheet with one row per customer, and each one gets an animated highlight reel of their year to tap through and share.
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
      <p class="sub rise" style="--d: 60ms">Apps, newsletters, online shops, gyms, studios, camps and daycares. If you know what each customer did this year, they can have a highlight reel of it.</p>
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
      <div class="switcher rise" role="group" aria-label="Example highlight reels">
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
      <p class="sub rise" style="--d: 60ms">Not per customer. Upload your list once and everyone on it gets their own highlight reel. No subscription.</p>
      <ul class="tiers">
        <li v-for="(t, i) in tiers" :key="t.size" class="tier rise" :class="{ founding: t.founding }" :style="{ '--d': `${120 + i * 60}ms` }">
          <p v-if="t.founding" class="tier-flag">founding price for our first businesses</p>
          <p class="tier-size">Up to {{ t.size }} customers</p>
          <p class="tier-price">
            {{ t.price }}<s v-if="t.was" class="tier-was"><span class="sr-only">instead of </span>{{ t.was }}</s>
          </p>
          <p class="tier-per">for the whole campaign</p>
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
        <h2 class="closing-title rise">Highlight reels go out in December. Have yours ready.</h2>
        <div ref="closingCta" class="rise" style="--d: 100ms">
          <NuxtLink to="/login?demo=1" class="btn">Try the demo <ArrowRight class="size-[18px]" /></NuxtLink>
        </div>
      </div>
      <div class="foot">
        <span class="wordmark small">highreel</span>
        <NuxtLink to="/terms" class="foot-link">Terms</NuxtLink>
        <NuxtLink to="/privacy" class="foot-link">Privacy</NuxtLink>
        <a :href="`mailto:${CONTACT_EMAIL}`" class="foot-link">{{ CONTACT_EMAIL }}</a>
      </div>
    </footer>

    <NuxtLink to="/login?demo=1" class="btn btn-sm sticky-cta" :class="{ on: stickyOn }">Try the demo</NuxtLink>
  </div>
</template>

<style>
body.landing-page {
  background: #FFFFFF;
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
  --ink: #222222;
  --muted: #6F6F6F;
  /* handwritten notes only: 24 px and up, so 3:1 is enough */
  --faint: #7E7E7E;
  --card: #F2F2F2;
  --line: #E7E7E7;
  --cta: #4560FF;
  --spring: cubic-bezier(0.25, 1.35, 0.45, 1);
  --ease-out: cubic-bezier(0.22, 1, 0.36, 1);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --v-warn: #D2371F;
  overflow-x: clip;
  background: #FFFFFF;
  color: var(--ink);
  font-family: 'Outfit', var(--font-sans);
  font-size: 1rem;
  line-height: 1.5;
}

/* --- Type -------------------------------------------------------------------- */
.wordmark {
  font-size: 23px;
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
.tab:focus-visible,
.text-link:focus-visible,
.nav-link:focus-visible,
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

.sticker {
  padding: 11px 16px 12px;
  border-radius: 18px;
  background: var(--bg);
  color: var(--fg);
  box-shadow: 0 0 0 5px #FFFFFF, 0 12px 26px -8px rgb(0 0 0 / 0.3);
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
  width: 272px;
  padding: 9px 16px 9px 9px;
  border-radius: 22px;
  background: rgb(232 232 237 / 0.85);
  text-align: left;
}
@media (max-width: 719px) {
  .mail { width: 248px; }
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
  color: #3A3A3A;
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
.nav-link {
  color: var(--muted);
  font-size: 16px;
  font-weight: 500;
  text-decoration: none;
}
.nav-link:hover { color: var(--ink); }
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
.tab:hover { background: #E6E6E6; }
.tab:active { transform: scale(0.96); }
.tab[aria-pressed='true'] { background: var(--ink); color: #FFFFFF; }
.tab-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  box-shadow: 0 0 0 1.5px #FFFFFF;
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
  gap: 14px;
  max-width: 860px;
  margin: 52px auto 0;
  text-align: left;
}
@media (min-width: 760px) {
  .tiers { grid-template-columns: repeat(3, 1fr); align-items: end; }
}
.tier {
  position: relative;
  padding: 26px 26px 24px;
  border-radius: 28px;
  background: var(--card);
}
.tier.founding {
  background: #FFFFFF;
  box-shadow: inset 0 0 0 2px var(--ink);
}
.tier-flag {
  margin-bottom: 10px;
  color: var(--cta);
  font-family: 'Recap Notes', cursive;
  font-size: 24px;
  line-height: 1.05;
}
.tier-size {
  font-size: 16px;
  font-weight: 500;
  color: var(--muted);
}
.tier-price {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-top: 6px;
  font-size: 52px;
  font-weight: 600;
  line-height: 1;
  letter-spacing: -0.035em;
}
.tier-was {
  color: var(--faint);
  font-size: 22px;
  font-weight: 500;
  letter-spacing: -0.01em;
}
.tier-per {
  margin-top: 10px;
  color: var(--muted);
  font-size: 15px;
}
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
  align-items: baseline;
  justify-content: center;
  gap: 6px 22px;
  padding: 0 16px 28px;
  color: var(--muted);
  font-size: 14px;
  font-weight: 500;
}
.foot-link {
  color: inherit;
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 3px;
}
.foot-link:hover { color: var(--ink); }
.foot-link:focus-visible {
  outline: 2px solid var(--cta);
  outline-offset: 3px;
  border-radius: 4px;
}

@media (prefers-reduced-motion: reduce) {
  .pop, .rise, .gate.in .pop, .gate.in .rise { animation: none !important; opacity: 1 !important; }
  .blob .spin, .doodle path, .piece > span { animation: none !important; }
  .stage-shape, .sticky-cta, .btn, .tab, .chev { transition: none; }
}
</style>
