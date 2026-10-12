<script setup lang="ts">
// Instagram-stories player (SPEC §5.2): segmented progress bar, tap right /
// left to move, press-and-hold to pause (scenes freeze too), auto-advance
// after each scene's duration (not on the share slide), arrow keys and space
// in live mode. Slides enter with their scene's transition (M2.5 P1). With
// "Guess first", a slide waits for the viewer's guess before it reveals.
// `paused` (the recap page's pause button, K or P, SPEC M2.8) stops the
// story and freezes the scene like a hold, until it's played or moved on.
// "Save image" on the last slide (M2.13) shrinks the story up and opens the
// picker (RecapSaver) below it; a hovered or held card shows in the story.
// Used by /r/[token] and by the workspace preview.
import { usePreferredReducedMotion } from '@vueuse/core'
import type { RecapEventType, RecapPayload } from '#shared/types/recap'
import { recapPalette } from '#shared/utils/color'
import { templateFor } from '#shared/templates'
import { buildSlides, shareTexts } from '#shared/utils/slides'
import { RECAP_CLOCK } from '~/lib/recap'

const props = withDefaults(defineProps<{
  payload: RecapPayload
  mode?: 'live' | 'preview'
  autoplay?: boolean
}>(), {
  mode: 'live',
  autoplay: true,
})
const emit = defineEmits<{ event: [type: RecapEventType] }>()

const HOLD_MS = 220

const root = ref<HTMLElement | null>(null)
// The template plus the recap's own columns and slides (SPEC M2.7), from the payload's settings.
const template = computed(() => templateFor(props.payload.template_key, props.payload.settings))
const slides = computed(() => buildSlides(template.value, props.payload))
const index = ref(0)
const slide = computed(() => slides.value[Math.min(index.value, slides.value.length - 1)]!)
const theme = computed(() => props.payload.settings.theme ?? 'stories')
// "Ana's 2026 with Habitly", "Our 2026 at Green Valley Farm": the template's share title.
const label = computed(() => shareTexts(template.value, props.payload).title)
const palette = computed(() => recapPalette(props.payload.business.accent_color, theme.value))
const tone = computed(() => palette.value[slide.value.tone])

const motion = usePreferredReducedMotion()
// Read after mount: the server can't know the preference, and a class that
// differs at hydration is never patched in production. Until then the CSS
// media query keeps scenes still.
const mounted = ref(false)
onMounted(() => {
  mounted.value = true
})
const reduced = computed(() => mounted.value && motion.value === 'reduce')

const playing = ref(props.autoplay)
const held = ref(false)
const paused = ref(false)
const frozen = computed(() => held.value || paused.value)
const progress = ref(0)
provide(RECAP_CLOCK, { held: frozen, reduced })

// Guess first: what the viewer picked per slide ('skip' = revealed without guessing).
const guesses = reactive(new Map<string, number | 'skip'>())
const awaitingGuess = computed(() => !!slide.value.guess && !guesses.has(slide.value.key))
watch(() => JSON.stringify(props.payload.recipient), () => guesses.clear())

// --- Save images (M2.13) ---------------------------------------------------------------
const picking = ref(false)
const peekKey = ref<string | null>(null)
const peekIndex = computed(() => (peekKey.value ? slides.value.findIndex(s => s.key === peekKey.value) : -1))
function openPicker() {
  picking.value = true
  peekKey.value = null
}
function closePicker() {
  picking.value = false
  peekKey.value = null
  nextTick(() => root.value?.querySelector<HTMLElement>('[data-save-image]')?.focus({ preventScroll: true }))
}

const direction = ref<'forward' | 'back'>('forward')
const transitionName = computed(() => `t-${direction.value === 'back' ? 'back' : slide.value.transition}`)

function go(i: number) {
  if (picking.value)
    closePicker()
  const to = Math.max(0, Math.min(slides.value.length - 1, i))
  direction.value = to < index.value ? 'back' : 'forward'
  index.value = to
  progress.value = 0
  paused.value = false
}
function next() {
  if (awaitingGuess.value)
    guesses.set(slide.value.key, 'skip')
  else if (index.value < slides.value.length - 1)
    go(index.value + 1)
  else
    progress.value = 1
}
function prev() {
  go(index.value - 1)
}
function answer(value: number) {
  guesses.set(slide.value.key, value)
  progress.value = 0
}

// When the recipient changes (preview), stay on the same kind of slide.
watch(slides, (now, before) => {
  const key = before[index.value]?.key
  const at = now.findIndex(s => s.key === key)
  index.value = at >= 0 ? at : Math.min(index.value, now.length - 1)
})

// Timer
let raf = 0
let last = 0
function tick(t: number) {
  const dt = last ? Math.min(t - last, 100) : 0
  last = t
  if (playing.value && !frozen.value && slide.value.autoAdvance && !awaitingGuess.value && !document.hidden) {
    progress.value += dt / slide.value.duration
    if (progress.value >= 1)
      next()
  }
  raf = requestAnimationFrame(tick)
}
onMounted(() => {
  raf = requestAnimationFrame(tick)
})
onBeforeUnmount(() => cancelAnimationFrame(raf))

// Tap and hold
let holdTimer: ReturnType<typeof setTimeout> | undefined
let tracking = false
function onPointerDown(e: PointerEvent) {
  if (picking.value || e.button !== 0 || (e.target as HTMLElement).closest('a, button'))
    return
  tracking = true
  holdTimer = setTimeout(() => {
    held.value = true
  }, HOLD_MS)
}
function onPointerUp(e: PointerEvent) {
  if (!tracking)
    return
  tracking = false
  clearTimeout(holdTimer)
  if (held.value) {
    held.value = false
    return
  }
  const rect = root.value!.getBoundingClientRect()
  if (e.clientX - rect.left < rect.width / 2)
    prev()
  else
    next()
}
function onPointerCancel() {
  tracking = false
  clearTimeout(holdTimer)
  held.value = false
}

function onKey(e: KeyboardEvent) {
  if (picking.value) {
    if (e.key === 'Escape')
      closePicker()
    return
  }
  if (props.mode !== 'live' || e.metaKey || e.ctrlKey || e.altKey)
    return
  const target = e.target as HTMLElement
  if (target.closest('input, textarea'))
    return
  // Space on a focused button or link presses it; arrows still move.
  if (e.key === ' ' && target.closest('button, a'))
    return
  if (e.key === 'ArrowRight' || e.key === ' ') {
    e.preventDefault()
    next()
  }
  else if (e.key === 'ArrowLeft') {
    e.preventDefault()
    prev()
  }
  else if (e.key === 'k' || e.key === 'p') {
    paused.value = !paused.value
  }
}
onMounted(() => window.addEventListener('keydown', onKey))

// Fetch the logo and photos up front so photo slides appear instantly.
const preloaded = new Set<string>()
function preload() {
  const urls = [props.payload.business.logo_url, ...props.payload.settings.photos.map(p => p.url)]
  for (const url of urls) {
    if (url && !preloaded.has(url)) {
      preloaded.add(url)
      new Image().src = url
    }
  }
}
onMounted(preload)
watch(() => props.payload, preload)
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

function segmentFill(i: number) {
  if (i < index.value)
    return 1
  if (i > index.value)
    return 0
  return slide.value.autoAdvance ? Math.min(1, progress.value) : 1
}

defineExpose({
  index,
  count: computed(() => slides.value.length),
  slide,
  /** the current slide's colours (a frame's status bar follows tone.fg) */
  tone,
  /** slide keys in order ('cover', the template's slides, 'photo-…', 'note', 'share'): editors jump to one with go() */
  keys: computed(() => slides.value.map(x => x.key)),
  playing,
  /** the viewer paused the story (live mode's pause button) */
  paused,
  /** the save picker is open (M2.13) */
  picking,
  go,
  next,
  prev,
})
</script>

<template>
  <div
    ref="root"
    class="recap"
    :class="[`theme-${theme}`, { 'is-held': frozen, 'is-reduced': reduced, 'is-picking': picking }]"
    :style="{ background: tone.bg, color: tone.fg }"
    role="region"
    aria-roledescription="story"
    :aria-label="label"
    @pointerdown="onPointerDown"
    @pointerup="onPointerUp"
    @pointercancel="onPointerCancel"
    @pointerleave="onPointerCancel"
    @contextmenu.prevent
  >
    <!-- Behind the shrunken story while picking: the business's dark tone, deepened. -->
    <div v-if="picking" class="pick-bg" :style="{ background: `color-mix(in srgb, ${palette.dark.bg} 38%, #0b0b0b)` }" aria-hidden="true" />

    <!-- The story; it shrinks up out of the picker's way (a tap on it closes the picker). -->
    <div class="stage" :class="{ shrunk: picking, peeking: peekIndex >= 0 }" @click="picking && closePicker()">
    <!-- With reduced motion, css=false swaps slides instantly (no leave phase). -->
    <Transition :name="transitionName" :css="!reduced">
      <RecapShare
        v-if="slide.key === 'share'"
        key="share"
        :payload="payload"
        :palette="palette"
        :theme="theme"
        :mode="mode"
        :reduced="reduced"
        @event="emit('event', $event)"
        @pick="openPicker"
      />
      <RecapSlide
        v-else
        :key="slide.key"
        :slide="slide"
        :payload="payload"
        :tone="tone"
        :palette="palette"
        :theme="theme"
        :reduced="reduced"
        :position="index"
        :count="slides.length"
        :guess="slide.guess ? (guesses.get(slide.key) ?? null) : undefined"
        @answer="answer"
      />
    </Transition>

    <div class="progress" aria-hidden="true">
      <span v-for="(s, i) in slides" :key="s.key" class="segment" :style="{ background: `color-mix(in srgb, ${tone.fg} 30%, transparent)` }">
        <span class="fill" :style="{ transform: `scaleX(${segmentFill(i)})`, background: tone.fg }" />
      </span>
    </div>

    <!-- A card under the pointer, or held on a phone, shows here at story size; one fades into the next. -->
    <Transition name="peek">
      <RecapStill
        v-if="picking && peekIndex >= 0"
        :key="`peek-${peekKey}`"
        class="peek"
        :slide="slides[peekIndex]!"
        :payload="payload"
        :palette="palette"
        :theme="theme"
        :position="peekIndex"
        :count="slides.length"
        :data-peek="peekKey"
      />
    </Transition>
    </div>

    <RecapSaver
      v-if="picking"
      :payload="payload"
      :slides="slides"
      :palette="palette"
      :theme="theme"
      @close="closePicker"
      @saved="emit('event', 'save')"
      @peek="peekKey = $event"
    />
    <p class="sr-only" aria-live="polite">Slide {{ index + 1 }} of {{ slides.length }}</p>
  </div>
</template>

<style src="./recap.css"></style>

<style scoped>
.recap {
  position: relative;
  container-type: size;
  overflow: hidden;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
  touch-action: manipulation;
  font-family: var(--font-sans);
  transition: background-color 300ms ease;
}
.stage {
  position: absolute;
  inset: 0;
  z-index: 1;
  transform-origin: 50% 0;
  transition: transform 480ms var(--ease-out), border-radius 480ms var(--ease-out), box-shadow 480ms ease;
}
/* Picking: the story moves up and shrinks above the picker (39cqh tall). */
.stage.shrunk {
  overflow: hidden;
  border-radius: calc(7 * var(--u));
  transform: translateY(2.6cqh) scale(0.555);
  box-shadow: 0 30px 70px rgb(0 0 0 / 0.5);
  cursor: pointer;
}
.stage.shrunk.peeking { transform: translateY(2.6cqh) scale(0.57); }
.stage.shrunk > * { pointer-events: none; }
.stage.shrunk .progress { opacity: 0; }
.pick-bg {
  position: absolute;
  inset: 0;
  z-index: 0;
  animation: pick-bg-in 300ms ease both;
}
@keyframes pick-bg-in { from { opacity: 0; } }
.peek {
  position: absolute;
  inset: 0;
  z-index: 4;
}
.peek-enter-active,
.peek-leave-active { transition: opacity 300ms ease; }
.peek-enter-from,
.peek-leave-to { opacity: 0; }
.recap.is-reduced .stage, .recap.is-reduced .pick-bg, .recap.is-reduced .peek { transition: none; animation: none; }
.progress {
  position: absolute;
  top: calc(var(--recap-inset-top, 0px) + min(3.6cqw, 2cqh));
  left: min(3.6cqw, 2cqh);
  right: min(3.6cqw, 2cqh);
  display: flex;
  gap: min(1.2cqw, 0.7cqh);
  z-index: 3;
  pointer-events: none;
}
.segment {
  position: relative;
  flex: 1;
  height: max(2px, 0.8cqw);
  border-radius: 9999px;
  overflow: hidden;
}
.fill {
  position: absolute;
  inset: 0;
  transform-origin: left;
}
</style>
