<script setup lang="ts">
// One story slide (SPEC M2.5 P1): the backdrop, the slide's scene, the brand
// footer, and with "Guess first" the question before the scene. Sizes use
// container units (--u), so the same slide works in the 380 px preview, on a
// phone and on desktop.
import type { Component } from 'vue'
import type { RecapPayload } from '#shared/types/recap'
import type { RecapPalette, RecapTheme, Tone } from '#shared/utils/color'
import type { Slide } from '#shared/utils/slides'
import { formatNumber } from '#shared/utils/slides'
import SceneBadge from './scenes/SceneBadge.vue'
import SceneCount from './scenes/SceneCount.vue'
import SceneCover from './scenes/SceneCover.vue'
import SceneDate from './scenes/SceneDate.vue'
import SceneDays from './scenes/SceneDays.vue'
import SceneLine from './scenes/SceneLine.vue'
import SceneNote from './scenes/SceneNote.vue'
import ScenePhoto from './scenes/ScenePhoto.vue'
import SceneRank from './scenes/SceneRank.vue'
import SceneStreak from './scenes/SceneStreak.vue'
import SceneTimeline from './scenes/SceneTimeline.vue'
import SceneWord from './scenes/SceneWord.vue'
// The M2.10 library.
import SceneBigNumber from './scenes/SceneBigNumber.vue'
import SceneBubbles from './scenes/SceneBubbles.vue'
import SceneClimb from './scenes/SceneClimb.vue'
import SceneFill from './scenes/SceneFill.vue'
import SceneGauge from './scenes/SceneGauge.vue'
import SceneLeaderboard from './scenes/SceneLeaderboard.vue'
import SceneLetters from './scenes/SceneLetters.vue'
import SceneList from './scenes/SceneList.vue'
import ScenePodium from './scenes/ScenePodium.vue'
import ScenePostmark from './scenes/ScenePostmark.vue'
import SceneSlots from './scenes/SceneSlots.vue'
import SceneSticker from './scenes/SceneSticker.vue'
import SceneTally from './scenes/SceneTally.vue'

const props = defineProps<{
  slide: Slide
  payload: RecapPayload
  tone: Tone
  palette: RecapPalette
  theme: RecapTheme
  reduced: boolean
  position: number
  count: number
  /** with Guess first: null while waiting, then the pick ('skip' = revealed without one) */
  guess?: number | 'skip' | null
}>()
const emit = defineEmits<{ answer: [value: number] }>()

const SCENES: Record<string, Component> = {
  cover: SceneCover,
  days: SceneDays,
  streak: SceneStreak,
  count: SceneCount,
  word: SceneWord,
  badge: SceneBadge,
  rank: SceneRank,
  timeline: SceneTimeline,
  date: SceneDate,
  note: SceneNote,
  since: SceneNote,
  photo: ScenePhoto,
  line: SceneLine,
  tally: SceneTally,
  fill: SceneFill,
  slots: SceneSlots,
  bignumber: SceneBigNumber,
  bubbles: SceneBubbles,
  gauge: SceneGauge,
  climb: SceneClimb,
  sticker: SceneSticker,
  typewriter: SceneLetters,
  flap: SceneLetters,
  neon: SceneLetters,
  scatter: SceneLetters,
  spotlight: SceneLetters,
  postmark: ScenePostmark,
  podium: ScenePodium,
  leaderboard: SceneLeaderboard,
  receipt: SceneList,
  cards: SceneList,
  checklist: SceneList,
}

const paper = computed(() => props.theme === 'paper')
const counter = computed(() => `${String(props.position + 1).padStart(2, '0')} / ${String(props.count).padStart(2, '0')}`)
const business = computed(() => props.payload.business.name)
// Paper's palette keeps the accent in `shape`; Stories' accent tone is the accent itself.
const accent = computed(() => (paper.value ? props.tone.shape : props.palette.accent.bg))
const guessed = computed(() => {
  const g = props.guess
  if (typeof g !== 'number')
    return null
  const v = props.slide.value!
  return g === v ? 'Spot on' : `You guessed ${props.slide.prefix ?? ''}${formatNumber(g)}${props.slide.suffix ?? ''}`
})
</script>

<template>
  <div
    class="slide"
    :class="[`scene-${slide.scene}`, { paper }]"
    :data-scene="slide.scene"
    :data-duration="slide.duration"
    :style="{ background: tone.bg, color: tone.fg }"
  >
    <div class="slide-inner">
      <SceneBackdrop
        :tone="tone"
        :tone-name="slide.tone"
        :accent="accent"
        :paper="paper"
        :variant="position"
        :blobs="slide.scene !== 'cover'"
      />

      <div v-if="paper" class="paper-meta" aria-hidden="true">
        <span>{{ counter }}</span>
        <span>{{ payload.year }}</span>
      </div>

      <GuessFirst v-if="guess === null" :slide="slide" :tone="tone" :paper="paper" :reduced="reduced" @answer="emit('answer', $event)" />
      <component :is="SCENES[slide.scene]" v-else :slide="slide" :payload="payload" :tone="tone" :paper="paper" :reduced="reduced" />

      <p v-if="guessed" class="guess-chip" :style="{ background: tone.fg, color: tone.bg }">{{ guessed }}</p>

      <div v-if="slide.scene !== 'cover'" class="brand">
        <RecapMonogram :name="business" :logo-url="payload.business.logo_url" :shape="payload.business.logo_shape" :bg="tone.fg" :fg="tone.bg" size="calc(6 * var(--u))" />
        <span>{{ business }}</span>
        <span class="brand-year">{{ payload.year }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.brand {
  position: absolute;
  left: calc(8 * var(--u));
  right: calc(8 * var(--u));
  bottom: calc(8 * var(--u));
  display: flex;
  align-items: center;
  gap: calc(2.4 * var(--u));
  font-size: calc(3.6 * var(--u));
  font-weight: 600;
}
.brand-year {
  margin-left: auto;
  opacity: 0.7;
  font-variant-numeric: tabular-nums;
}
.paper-meta {
  position: absolute;
  top: calc(9 * var(--u));
  left: calc(8 * var(--u));
  right: calc(8 * var(--u));
  display: flex;
  justify-content: space-between;
  padding-bottom: calc(2.4 * var(--u));
  border-bottom: 1px solid color-mix(in srgb, currentColor 22%, transparent);
  font-family: var(--font-mono);
  font-size: calc(3.2 * var(--u));
  letter-spacing: 0.04em;
  opacity: 0.75;
}
.guess-chip {
  position: absolute;
  top: calc(8 * var(--u));
  left: 50%;
  translate: -50% 0;
  padding: calc(1.4 * var(--u)) calc(3.4 * var(--u));
  border-radius: 9999px;
  font-size: calc(3.6 * var(--u));
  font-weight: 700;
  white-space: nowrap;
  animation: chip 3200ms var(--ease-out) both;
}
@keyframes chip {
  from { opacity: 0; transform: translateY(calc(-3 * var(--u))) scale(0.8); }
  12% { opacity: 1; transform: none; }
  85% { opacity: 1; transform: none; }
  to { opacity: 0; transform: none; }
}
</style>
