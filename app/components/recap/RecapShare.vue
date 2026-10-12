<script setup lang="ts">
// Last slide: summary card, Save image (since M2.13 it opens the player's
// picker: any slides, not just this card), Share (only where file sharing is
// confirmed), the business's button and "Made with Highreel" (SPEC §5.1, §5.4).
// The card assembles as its stat tiles fly in, then a small confetti burst
// (SPEC M2.5 P1).
import type { RecapEventType, RecapPayload } from '#shared/types/recap'
import type { RecapPalette, RecapTheme } from '#shared/utils/color'
import { mix } from '#shared/utils/color'
import { isHttpUrl } from '#shared/utils/recap'
import { seeded } from '#shared/utils/scenes'
import { shareStats, shareTexts } from '#shared/utils/slides'
import { templateFor } from '#shared/templates'
import { canShareFiles, downloadBlob, renderShareImage, shareFileName } from '~/utils/shareImage'

const props = defineProps<{
  payload: RecapPayload
  palette: RecapPalette
  theme: RecapTheme
  mode: 'live' | 'preview'
  reduced: boolean
}>()
const emit = defineEmits<{ event: [type: RecapEventType], pick: [] }>()

const template = computed(() => templateFor(props.payload.template_key, props.payload.settings))
const stats = computed(() => shareStats(template.value, props.payload))
const texts = computed(() => shareTexts(template.value, props.payload))
const tone = computed(() => props.palette.dark)
const card = computed(() => props.palette.accent)
const business = computed(() => props.payload.business.name)
const paper = computed(() => props.theme === 'paper')
const accent = computed(() => (paper.value ? card.value.shape : card.value.bg))

// Tiles fly in from around the card; each lands with a spring.
const FROM = [
  { x: -46, y: -30, r: -14 },
  { x: 48, y: -36, r: 12 },
  { x: -40, y: 46, r: 10 },
  { x: 44, y: 40, r: -12 },
]
const tiles = computed(() => stats.value.map((s, i) => ({
  ...s,
  numeric: /^[\d,.%€$£+]+$/.test(s.value),
  wide: stats.value.length === 3 && i === 2,
  style: {
    '--fx': `calc(${FROM[i]!.x} * var(--u))`,
    '--fy': `calc(${FROM[i]!.y} * var(--u))`,
    '--fr': `${FROM[i]!.r}deg`,
    '--d': `${620 + i * 110}ms`,
  },
})))

// Confetti: seeded by the recipient, so it's the same burst every time.
const confetti = computed(() => {
  const rand = seeded(`confetti|${props.payload.recipient.first_name}`)
  const colours = [card.value.fg, card.value.bg, tone.value.hi, mix(card.value.bg, '#FFFFFF', 0.5)]
  return Array.from({ length: 28 }, (_, i) => ({
    key: i,
    round: rand() < 0.3,
    colour: colours[Math.floor(rand() * colours.length)],
    style: {
      '--x': `calc(${((rand() - 0.5) * 92).toFixed(1)} * var(--u))`,
      '--up': `calc(${(-22 - rand() * 30).toFixed(1)} * var(--u))`,
      '--down': `calc(${(40 + rand() * 45).toFixed(1)} * var(--u))`,
      '--r': `${Math.round((rand() - 0.5) * 1080)}deg`,
      '--dur': `${Math.round(1500 + rand() * 900)}ms`,
    },
  }))
})

const cta = computed(() => {
  const { cta_label, cta_url } = props.payload.settings
  return cta_label.trim() && isHttpUrl(cta_url) ? { label: cta_label.trim(), url: cta_url } : null
})

// Draw the image as soon as the slide shows, so Share can run inside the tap
// (Safari drops the share sheet if we await a canvas first).
const image = shallowRef<Blob | null>(null)
const canShare = ref(false)
const working = ref(false)

async function draw() {
  image.value = null
  image.value = await renderShareImage(props.payload).catch(() => null)
}
onMounted(() => {
  canShare.value = canShareFiles()
  draw()
})
watch(() => props.payload, draw, { deep: true })

async function save() {
  working.value = true
  try {
    const blob = image.value ?? await renderShareImage(props.payload)
    downloadBlob(blob, shareFileName(props.payload))
    emit('event', 'save')
  }
  finally {
    working.value = false
  }
}

async function share() {
  const blob = image.value
  if (!blob)
    return save()
  const file = new File([blob], shareFileName(props.payload), { type: 'image/png' })
  if (!navigator.canShare?.({ files: [file] }))
    return save()
  try {
    await navigator.share({ files: [file], title: texts.value.title })
    emit('event', 'share')
  }
  catch (e) {
    // Cancelled sheets are fine; anything else falls back to saving.
    if ((e as Error).name !== 'AbortError')
      await save()
  }
}
</script>

<template>
  <div class="slide scene-share" :class="{ paper }" data-scene="share" data-duration="0" :style="{ background: tone.bg, color: tone.fg }">
    <div class="slide-inner">
      <SceneBackdrop :tone="tone" tone-name="dark" :accent="accent" :paper="paper" :variant="2" />
      <div class="body">
        <p class="lead rise">{{ texts.lead }}</p>

        <div class="card-wrap">
          <div class="card" :style="{ background: card.bg, color: card.fg }">
            <div class="card-brand rise" style="--d: 360ms">
              <RecapMonogram :name="business" :logo-url="payload.business.logo_url" :shape="payload.business.logo_shape" :bg="card.fg" :fg="card.bg" size="calc(6.4 * var(--u))" />
              <span>{{ business }}</span>
            </div>
            <p class="card-title rise" style="--d: 440ms">{{ texts.title }}</p>
            <dl class="card-stats">
              <div v-for="s in tiles" :key="s.label" class="tile" :class="{ wide: s.wide }" :style="s.style">
                <dt class="sr-only">{{ s.label }}</dt>
                <dd class="stat-value" :class="{ numeric: s.numeric }">{{ s.value }}</dd>
                <dd class="stat-label">{{ s.label }}</dd>
              </div>
            </dl>
          </div>
          <div v-if="!reduced" class="confetti" aria-hidden="true">
            <span v-for="c in confetti" :key="c.key" class="bit-x" :style="c.style">
              <span class="bit" :class="{ round: c.round }" :style="{ background: c.colour }" />
            </span>
          </div>
        </div>

        <div class="actions rise" style="--d: 1250ms">
          <button type="button" class="btn btn-primary" data-save-image @click.stop="emit('pick')">
            Save image
          </button>
          <button v-if="canShare" type="button" class="btn btn-outline" @click="share">
            Share
          </button>
          <a
            v-if="cta"
            class="btn"
            :style="{ background: card.bg, color: card.fg }"
            :href="cta.url"
            target="_blank"
            rel="noopener"
            @click="emit('event', 'cta')"
          >{{ cta.label }}</a>
        </div>

        <a class="made-with" href="/" :target="mode === 'preview' ? '_blank' : undefined">Made with Highreel</a>
      </div>
    </div>
  </div>
</template>

<style scoped>
.body {
  position: relative;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: calc(4.5 * var(--u));
  padding: calc(13 * var(--u)) calc(7 * var(--u)) calc(7 * var(--u));
}
.lead {
  font-size: calc(6.6 * var(--u));
  font-weight: 700;
  letter-spacing: -0.025em;
  line-height: 1.1;
  text-wrap: balance;
}
.card-wrap { position: relative; }
.card {
  border-radius: calc(4 * var(--u));
  padding: calc(6 * var(--u));
  display: flex;
  flex-direction: column;
  gap: calc(3.5 * var(--u));
  animation: card-in 700ms var(--ease-soft) 180ms both;
}
@keyframes card-in {
  from { opacity: 0; transform: scale(0.86) translateY(calc(4 * var(--u))); }
}
.card-brand {
  display: flex;
  align-items: center;
  gap: calc(2.4 * var(--u));
  font-size: calc(3.6 * var(--u));
  font-weight: 600;
}
.card-title {
  font-size: calc(6.4 * var(--u));
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1.05;
  text-wrap: balance;
}
.card-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: calc(2.4 * var(--u));
  margin-top: calc(1 * var(--u));
}
.tile {
  padding: calc(3.2 * var(--u)) calc(3.4 * var(--u));
  border-radius: calc(2.6 * var(--u));
  background: color-mix(in srgb, currentColor 12%, transparent);
  animation: tile-in 760ms var(--ease-pop) both;
  animation-delay: var(--d);
}
.tile.wide { grid-column: span 2; }
@keyframes tile-in {
  from { opacity: 0; transform: translate(var(--fx), var(--fy)) rotate(var(--fr)) scale(0.7); }
}
.stat-value {
  font-size: calc(5.2 * var(--u));
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.05;
  font-variant-numeric: tabular-nums;
  /* words wrap whole; only a single over-long word breaks */
  overflow-wrap: break-word;
  text-wrap: balance;
}
.stat-value.numeric {
  font-size: calc(6.6 * var(--u));
  letter-spacing: -0.03em;
  line-height: 1;
}
.stat-label {
  margin-top: calc(1.2 * var(--u));
  font-size: calc(3.2 * var(--u));
  font-weight: 500;
  opacity: 0.8;
  line-height: 1.2;
}
.confetti {
  position: absolute;
  left: 50%;
  top: 18%;
  pointer-events: none;
}
.bit-x {
  position: absolute;
  animation: bit-x var(--dur) linear 1100ms both;
}
.bit {
  display: block;
  width: calc(1.6 * var(--u));
  height: calc(3 * var(--u));
  border-radius: calc(0.4 * var(--u));
  opacity: 0;
  animation: bit-y var(--dur) linear 1100ms both;
}
.bit.round {
  width: calc(1.9 * var(--u));
  height: calc(1.9 * var(--u));
  border-radius: 50%;
}
@keyframes bit-x {
  from { transform: none; }
  to { transform: translateX(var(--x)); }
}
@keyframes bit-y {
  /* hidden until the burst (fill-mode both holds this during the delay) */
  0% { opacity: 0; transform: translateY(0) rotate(0); animation-timing-function: linear; }
  2% { opacity: 1; transform: translateY(calc(var(--up) * 0.05)) rotate(0); animation-timing-function: cubic-bezier(0.2, 0.7, 0.4, 1); }
  35% { opacity: 1; transform: translateY(var(--up)) rotate(calc(var(--r) * 0.4)); animation-timing-function: cubic-bezier(0.5, 0, 0.9, 0.6); }
  80% { opacity: 1; }
  100% { opacity: 0; transform: translateY(var(--down)) rotate(var(--r)); }
}
.actions {
  display: flex;
  flex-direction: column;
  gap: calc(2.4 * var(--u));
}
.btn {
  display: flex;
  align-items: center;
  justify-content: center;
  height: calc(11.5 * var(--u));
  border-radius: 9999px;
  font-size: calc(4.2 * var(--u));
  font-weight: 600;
  text-decoration: none;
  transition: transform 120ms ease, opacity 120ms ease;
}
.btn:active { transform: scale(0.98); }
.btn:disabled { opacity: 0.6; }
.btn-primary { background: #fff; color: #0a0a0a; }
.btn-outline { border: 1.5px solid rgb(255 255 255 / 0.5); color: #fff; }
.paper .btn-primary { background: #151515; color: #F4F1EA; }
.paper .btn-outline { border-color: rgb(21 21 21 / 0.45); color: #151515; }
.paper .stat-value.numeric { font-family: var(--font-mono); font-weight: 600; letter-spacing: -0.05em; }
.made-with {
  align-self: center;
  font-size: calc(3.3 * var(--u));
  font-weight: 500;
  opacity: 0.6;
  text-decoration: none;
}
.made-with:hover { opacity: 0.9; text-decoration: underline; }
</style>
