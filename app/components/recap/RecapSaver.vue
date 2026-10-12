<script setup lang="ts">
// Save images (SPEC M2.13), opened by the summary slide's "Save image": every
// slide as a card to tick, the summary card ticked to start with. On laptops a
// card swells under the pointer, dock-like, and the shrunken story above shows
// it (`peek`); on phones a tap ticks and press-and-hold peeks. Each ticked
// slide is drawn as a 1080×1920 PNG while the viewer chooses (the summary card
// is the drawn share image; the others are captured from a still with
// modern-screenshot, loaded only here), so Save runs inside the tap: on phones
// the share sheet ("Save 3 Images" to Photos), elsewhere one download each.
import type { RecapPayload } from '#shared/types/recap'
import type { RecapPalette, RecapTheme } from '#shared/utils/color'
import type { Slide } from '#shared/utils/slides'
import { downloadBlob, renderShareImage, shareFileName } from '~/utils/shareImage'

const props = defineProps<{
  payload: RecapPayload
  slides: Slide[]
  palette: RecapPalette
  theme: RecapTheme
}>()
const emit = defineEmits<{ close: [], saved: [], peek: [key: string | null] }>()

const order = computed(() => props.slides.map(s => s.key))
const picked = ref<string[]>(order.value.includes('share') ? ['share'] : [])
const isPicked = (key: string) => picked.value.includes(key)
function toggle(key: string) {
  picked.value = isPicked(key) ? picked.value.filter(k => k !== key) : order.value.filter(k => k === key || isPicked(k))
}
const allPicked = computed(() => picked.value.length === order.value.length)
function toggleAll() {
  picked.value = allPicked.value ? [] : [...order.value]
}
const labelFor = (s: Slide, i: number) => (s.key === 'share' ? 'Summary card' : `Slide ${i + 1}`)

// --- Drawing the images -------------------------------------------------------------
const images = shallowReactive(new Map<string, Blob>())
const failed = shallowReactive(new Set<string>())
const capturing = ref<Slide | null>(null)
const host = ref<HTMLElement | null>(null)
let shot: Promise<typeof import('modern-screenshot')> | null = null
// The summary card's image is also its card's picture.
const shareImage = renderShareImage(props.payload)
const shareUrl = ref<string | null>(null)
shareImage.then((b) => {
  shareUrl.value = URL.createObjectURL(b)
}, () => {})
onMounted(() => {
  shot ??= import('modern-screenshot')
})
onBeforeUnmount(() => {
  if (shareUrl.value)
    URL.revokeObjectURL(shareUrl.value)
})

const frame = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
async function draw(slide: Slide): Promise<Blob> {
  if (slide.key === 'share')
    return shareImage
  capturing.value = slide
  await nextTick()
  await frame()
  await document.fonts.ready
  const el = host.value!.firstElementChild as HTMLElement
  await Promise.all([...el.querySelectorAll('img')].map(img => (img.complete ? null : new Promise((r) => {
    img.onload = img.onerror = r
  }))))
  const { domToBlob } = await (shot ??= import('modern-screenshot'))
  return domToBlob(el, { scale: 3, type: 'image/png' })
}
// One at a time, in order, whatever is ticked and not drawn yet.
let drawing = false
async function drawPicked() {
  if (drawing)
    return
  drawing = true
  try {
    for (;;) {
      const next = props.slides.find(s => isPicked(s.key) && !images.has(s.key) && !failed.has(s.key))
      if (!next)
        break
      try {
        images.set(next.key, await draw(next))
      }
      catch {
        failed.add(next.key)
      }
    }
  }
  finally {
    capturing.value = null
    drawing = false
  }
}
watch(picked, drawPicked, { immediate: true })

const pending = computed(() => picked.value.filter(k => !images.has(k) && !failed.has(k)).length)
const unsaveable = computed(() => props.slides.map((s, i) => ({ s, i })).filter(x => isPicked(x.s.key) && failed.has(x.s.key)))
const saving = ref(false)
const saved = ref(false)
const label = computed(() => {
  if (saved.value)
    return 'Saved'
  const n = picked.value.length - unsaveable.value.length
  if (!picked.value.length)
    return 'Pick the slides to save'
  if (pending.value)
    return `Getting ${n === 1 ? 'it' : 'them'} ready…`
  return `Save ${n} ${n === 1 ? 'image' : 'images'}`
})

function fileName(key: string): string {
  const base = shareFileName(props.payload)
  return key === 'share' ? base : base.replace(/\.png$/, `-${String(order.value.indexOf(key) + 1).padStart(2, '0')}.png`)
}
async function download(files: File[]) {
  for (const [i, f] of files.entries()) {
    if (i)
      await new Promise(r => setTimeout(r, 250))
    downloadBlob(f, f.name)
  }
}
async function save() {
  const keys = order.value.filter(k => isPicked(k) && images.has(k))
  if (!keys.length || pending.value)
    return
  const files = keys.map(k => new File([images.get(k)!], fileName(k), { type: 'image/png' }))
  saving.value = true
  try {
    // Phones: the share sheet saves to Photos ("Save 3 Images"). Called inside the tap: every image is ready.
    if (matchMedia('(pointer: coarse)').matches && navigator.canShare?.({ files })) {
      try {
        await navigator.share({ files })
      }
      catch (e) {
        if ((e as Error).name === 'AbortError')
          return
        await download(files)
      }
    }
    else {
      await download(files)
    }
    emit('saved')
    saved.value = true
    setTimeout(() => (saved.value = false), 2200)
  }
  finally {
    saving.value = false
  }
}

// --- Peeking --------------------------------------------------------------------------
// Pointer: hovering a card shows it above. Touch: press and hold shows it until
// you let go (a hold never ticks); moving the finger (scrolling) cancels it.
let press: { x: number, y: number, timer: ReturnType<typeof setTimeout> } | null = null
let held = false
function onDown(e: PointerEvent, key: string) {
  held = false
  if (e.pointerType === 'mouse')
    return
  press = {
    x: e.clientX,
    y: e.clientY,
    timer: setTimeout(() => {
      held = true
      emit('peek', key)
      navigator.vibrate?.(8)
    }, 380),
  }
}
function onMove(e: PointerEvent) {
  if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 10) {
    clearTimeout(press.timer)
    press = null
  }
}
function onUp() {
  if (press)
    clearTimeout(press.timer)
  press = null
  if (held)
    emit('peek', null)
}
function onClick(key: string) {
  if (held) {
    held = false
    return
  }
  toggle(key)
}
// Hover intent: the reel above switches once the pointer rests on a card for a
// moment, and stays through the gaps between cards, so sweeping across the
// strip doesn't flicker it.
let intent: ReturnType<typeof setTimeout> | undefined
function hoverPeek(key: string | null, ms: number) {
  clearTimeout(intent)
  intent = setTimeout(() => emit('peek', key), ms)
}
onBeforeUnmount(() => clearTimeout(intent))
function onEnter(e: PointerEvent, key: string) {
  if (e.pointerType === 'mouse')
    hoverPeek(key, 140)
}
function onLeave(e: PointerEvent) {
  if (e.pointerType === 'mouse')
    hoverPeek(null, 260)
}
function onFocus(e: FocusEvent, key: string) {
  if ((e.target as HTMLElement).matches(':focus-visible'))
    emit('peek', key)
}

const strip = ref<HTMLElement | null>(null)
onMounted(() => {
  // Start at the ticked summary card (the end of the strip), and let the keyboard in.
  // Not scrollIntoView: while the sheet slides up it would scroll the whole story frame too.
  const s = strip.value
  const first = s?.querySelector<HTMLElement>('[aria-pressed="true"]') ?? s?.querySelector<HTMLElement>('button')
  if (s && first)
    s.scrollLeft = first.offsetLeft - (s.clientWidth - first.offsetWidth) / 2
  first?.focus({ preventScroll: true })
})
</script>

<template>
  <div class="saver" role="dialog" aria-label="Save images" @keydown.esc.stop.prevent="emit('close')">
    <div class="head">
      <p class="title">Save images</p>
      <button type="button" class="text-btn" @click="toggleAll">{{ allPicked ? 'Clear' : 'Select all' }}</button>
      <button type="button" class="close" aria-label="Close" @click="emit('close')">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
      </button>
    </div>

    <div ref="strip" class="strip" role="group" aria-label="Slides to save" @pointermove="onMove">
      <button
        v-for="(s, i) in slides"
        :key="s.key"
        type="button"
        class="card"
        :class="{ on: isPicked(s.key) }"
        :aria-pressed="isPicked(s.key)"
        :aria-label="labelFor(s, i)"
        :data-card="s.key"
        @pointerdown="onDown($event, s.key)"
        @pointerup="onUp"
        @pointercancel="onUp"
        @pointerenter="onEnter($event, s.key)"
        @pointerleave="onLeave"
        @focus="onFocus($event, s.key)"
        @blur="emit('peek', null)"
        @click="onClick(s.key)"
        @contextmenu.prevent
      >
        <RecapStill class="card-still" :slide="s" :payload="payload" :palette="palette" :theme="theme" :position="i" :count="slides.length" :share-url="shareUrl" />
        <span class="shine" aria-hidden="true" />
        <span class="tick" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
        </span>
        <span class="num" aria-hidden="true">{{ s.key === 'share' ? '★' : i + 1 }}</span>
      </button>
    </div>

    <button type="button" class="save" :disabled="!picked.length || !!pending || saving || picked.length === unsaveable.length" data-testid="save-images" @click="save">
      {{ label }}
    </button>
    <p v-if="unsaveable.length" class="note" role="status">
      {{ unsaveable.map(x => labelFor(x.s, x.i)).join(', ') }} couldn't be drawn here; the others still save.
    </p>

    <!-- Where each ticked slide is drawn at 360×640 (×3) for its image; never seen. -->
    <div ref="host" class="capture-host" aria-hidden="true">
      <RecapStill
        v-if="capturing"
        :key="capturing.key"
        :slide="capturing"
        :payload="payload"
        :palette="palette"
        :theme="theme"
        :position="order.indexOf(capturing.key)"
        :count="slides.length"
      />
    </div>
  </div>
</template>

<style scoped>
.saver {
  /* Vertical rhythm: a hundredth of the story frame's height. */
  --vu: 1cqh;
  /* Calm, no overshoot: the springs made sweeping across the cards look jittery. */
  --hover-ease: cubic-bezier(0.25, 0.8, 0.3, 1);
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 6;
  height: calc(39 * var(--vu));
  display: flex;
  flex-direction: column;
  gap: calc(0.8 * var(--vu));
  padding: calc(2.2 * var(--vu)) calc(5 * var(--u)) calc(2.4 * var(--vu) + env(safe-area-inset-bottom, 0px));
  border-radius: calc(6 * var(--u)) calc(6 * var(--u)) 0 0;
  background: #FAFAF8;
  color: #151515;
  box-shadow: 0 -10px 40px rgb(0 0 0 / 0.28);
  font-family: var(--font-sans);
  animation: sheet-up 520ms var(--ease-out) both;
  cursor: default;
}
@keyframes sheet-up {
  from { transform: translateY(100%); }
}
.head {
  display: flex;
  align-items: center;
  gap: calc(3 * var(--u));
}
.title {
  margin-right: auto;
  font-size: calc(4.8 * var(--u));
  font-weight: 700;
  letter-spacing: -0.02em;
}
.text-btn {
  font-size: calc(3.6 * var(--u));
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 0.2em;
  opacity: 0.75;
}
.text-btn:hover { opacity: 1; }
.close {
  display: grid;
  place-items: center;
  width: calc(8.4 * var(--u));
  height: calc(8.4 * var(--u));
  border-radius: 9999px;
  background: rgb(0 0 0 / 0.06);
}
.close:hover { background: rgb(0 0 0 / 0.1); }
.close svg {
  width: 52%;
  height: 52%;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.4;
  stroke-linecap: round;
}

/* The strip: cards side by side, scrolled sideways, room above for a card to rise. */
.strip {
  flex: 1;
  min-height: 0;
  display: flex;
  /* Room between cards for a hovered one to grow (+6 % a side) beside a growing neighbour (+2.5 %), and for two tick rings side by side. */
  gap: calc(4.8 * var(--u));
  margin: 0 calc(-5 * var(--u));
  /* Top room for a hovered card: it rises and grows 12 % from its foot. */
  padding: calc(4.4 * var(--vu)) calc(5 * var(--u)) calc(0.8 * var(--vu));
  overflow-x: auto;
  overflow-y: hidden;
  overscroll-behavior-x: contain;
  scroll-snap-type: x proximity;
  scroll-padding-inline: calc(5 * var(--u));
  scrollbar-width: none;
  touch-action: pan-x;
}
.strip::-webkit-scrollbar { display: none; }
/* Room after the last card (a scroller's end padding isn't kept everywhere). */
.strip::after {
  content: '';
  flex: none;
  width: calc(2.4 * var(--u));
}
.card {
  position: relative;
  flex: none;
  height: 100%;
  aspect-ratio: 9 / 16;
  border-radius: calc(2.6 * var(--u));
  scroll-snap-align: center;
  transform-origin: 50% 100%;
  transition: transform 560ms var(--hover-ease) 40ms, box-shadow 560ms var(--hover-ease) 40ms;
  box-shadow: 0 2px 8px rgb(0 0 0 / 0.14);
  -webkit-tap-highlight-color: transparent;
}
.card:active { transform: scale(0.97); }
.card-still {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  text-align: start;
  pointer-events: none;
}
/* Ticked: an ink ring and a filled check. */
.card::after {
  content: '';
  position: absolute;
  inset: calc(-0.9 * var(--u));
  border-radius: calc(3.4 * var(--u));
  box-shadow: 0 0 0 calc(0.7 * var(--u)) #151515;
  opacity: 0;
  transform: scale(0.96);
  transition: opacity 260ms ease, transform 360ms var(--hover-ease);
  pointer-events: none;
}
.card.on::after { opacity: 1; transform: none; }
.tick {
  position: absolute;
  top: calc(1.6 * var(--u));
  right: calc(1.6 * var(--u));
  display: grid;
  place-items: center;
  width: calc(5.6 * var(--u));
  height: calc(5.6 * var(--u));
  border-radius: 9999px;
  background: rgb(255 255 255 / 0.9);
  box-shadow: 0 0 0 1.5px rgb(0 0 0 / 0.18), 0 1px 4px rgb(0 0 0 / 0.2);
  transition: background-color 240ms ease, transform 360ms var(--hover-ease);
}
.tick svg {
  width: 62%;
  height: 62%;
  fill: none;
  stroke: #FFFFFF;
  stroke-width: 3;
  stroke-linecap: round;
  stroke-linejoin: round;
  opacity: 0;
  transform: scale(0.6);
  transition: opacity 220ms ease, transform 360ms var(--hover-ease);
}
.card.on .tick { background: #151515; box-shadow: 0 0 0 1.5px #FFFFFF, 0 1px 4px rgb(0 0 0 / 0.25); }
.card.on .tick svg { opacity: 1; transform: none; }
.num {
  position: absolute;
  left: calc(1.8 * var(--u));
  bottom: calc(1.4 * var(--u));
  min-width: calc(5 * var(--u));
  padding: 0 calc(1.2 * var(--u));
  border-radius: 9999px;
  background: rgb(0 0 0 / 0.55);
  color: #FFFFFF;
  font-size: calc(2.8 * var(--u));
  font-weight: 600;
  line-height: calc(4.6 * var(--u));
  text-align: center;
  font-variant-numeric: tabular-nums;
}
.shine {
  position: absolute;
  inset: 0;
  overflow: hidden;
  border-radius: inherit;
  pointer-events: none;
}
.shine::before {
  content: '';
  position: absolute;
  inset: -40% -60%;
  background: linear-gradient(115deg, transparent 42%, rgb(255 255 255 / 0.38) 50%, transparent 58%);
  transform: translateX(-70%);
}
.card:focus-visible { outline: 2px solid #4560FF; outline-offset: calc(1.6 * var(--u)); }

/* Laptops: the card under the pointer swells and rises, its neighbours a little, like a dock; a light sweeps across it. */
@media (hover: hover) and (pointer: fine) {
  .card:hover {
    z-index: 2;
    transform: translateY(calc(-1.4 * var(--vu))) scale(1.12);
    box-shadow: 0 14px 30px rgb(0 0 0 / 0.3);
  }
  .card:hover + .card,
  .card:has(+ .card:hover) {
    transform: translateY(calc(-0.5 * var(--vu))) scale(1.05);
  }
  .card:hover .shine::before {
    transform: translateX(70%);
    transition: transform 1200ms var(--hover-ease) 120ms;
  }
}

.save {
  flex: none;
  height: calc(11.5 * var(--u));
  border-radius: 9999px;
  background: #151515;
  color: #FFFFFF;
  font-size: calc(4.2 * var(--u));
  font-weight: 600;
  transition: opacity 150ms ease, transform 150ms ease;
}
.save:active:not(:disabled) { transform: scale(0.98); }
.save:disabled { opacity: 0.45; }
.note {
  margin-top: calc(-0.6 * var(--vu));
  font-size: calc(3 * var(--u));
  opacity: 0.7;
  text-align: center;
}

.capture-host {
  /* Anchored at the bottom: it reaches up into the frame, never below it (that would make the frame scrollable). */
  position: absolute;
  left: 0;
  bottom: 0;
  width: 360px;
  height: 640px;
  opacity: 0;
  pointer-events: none;
  z-index: -1;
  overflow: hidden;
}
.capture-host > * { width: 100%; height: 100%; }

@media (prefers-reduced-motion: reduce) {
  .saver, .card, .card::after, .tick, .tick svg, .shine::before { animation: none !important; transition: none !important; }
}
:global(.recap.is-reduced) .saver { animation: none; }
</style>
